import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_PROVIDERS = ["google", "openai", "custom"];
const ALLOWED_ACTIONS = ["generate", "edit", "upscale"];
const MAX_PROMPT_LENGTH = 5000;
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("API_KEY") || error.message.includes("configured")) {
      return "خطأ في إعداد الخدمة";
    }
    if (error.message.includes("AI API")) return "خدمة الذكاء الاصطناعي غير متاحة مؤقتاً";
    if (error.message.includes("No image")) return "لم يتم توليد صورة، حاول مجدداً";
  }
  return "حدث خطأ أثناء معالجة طلبك";
}

function validateCustomApi(customApi: any): { provider: string; apiKey: string; apiUrl?: string } | null {
  if (!customApi || typeof customApi !== "object") return null;
  if (!customApi.provider || !ALLOWED_PROVIDERS.includes(customApi.provider)) return null;
  if (!customApi.apiKey || typeof customApi.apiKey !== "string" || customApi.apiKey.length < 10 || customApi.apiKey.length > 500) return null;
  if (customApi.apiUrl && (typeof customApi.apiUrl !== "string" || !customApi.apiUrl.startsWith("https://"))) return null;
  return { provider: customApi.provider, apiKey: customApi.apiKey, apiUrl: customApi.apiUrl };
}

function getApiConfig(customApi: any) {
  const validated = validateCustomApi(customApi);
  if (validated) {
    switch (validated.provider) {
      case "google":
        return { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", apiKey: validated.apiKey };
      case "openai":
        return { url: "https://api.openai.com/v1/chat/completions", apiKey: validated.apiKey };
      case "custom":
        return { url: validated.apiUrl || "https://api.openai.com/v1/chat/completions", apiKey: validated.apiKey };
    }
  }
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("API_KEY not configured");
  }
  return { url: "https://ai.gateway.lovable.dev/v1/chat/completions", apiKey: LOVABLE_API_KEY };
}

function validateImageData(img: any): boolean {
  return typeof img === "string" && img.length > 0 && img.length <= MAX_IMAGE_SIZE;
}

function buildEditPromptWithReference(instructionText: string): string {
  return "You are an image editing tool. You will receive TWO images:\n" +
    "- IMAGE 1 (FIRST): The TARGET image you MUST edit in-place.\n" +
    "- IMAGE 2 (SECOND): A style/mood reference ONLY.\n\n" +
    "YOUR #1 PRIORITY: The output MUST be a pixel-accurate recreation of IMAGE 1 (the TARGET) with ONLY style changes applied.\n\n" +
    "ABSOLUTE RULES (NEVER BREAK THESE):\n" +
    "1. Every object in the TARGET image must appear at the EXACT SAME position, size, angle, and distance from camera. Do NOT move, resize, rotate, or reposition ANY element.\n" +
    "2. The building/subject must occupy the EXACT same pixels in the frame. If a building is in the center-right at 60% height, it MUST remain there.\n" +
    "3. ALL structural details must be preserved: number of windows, architectural features, text/signs, vehicles, people, trees - everything stays IDENTICAL.\n" +
    "4. The perspective, camera angle, lens distortion, and field of view must be EXACTLY the same as the TARGET.\n" +
    "5. The foreground, midground, and background layout must be pixel-identical to the TARGET.\n" +
    "6. The output dimensions and aspect ratio MUST match the TARGET image exactly.\n\n" +
    "WHAT YOU CAN CHANGE (from the reference image style ONLY):\n" +
    "- Sky/weather/atmosphere (e.g., cloudy sky, golden hour lighting)\n" +
    "- Color grading and tone\n" +
    "- Lighting direction and mood\n" +
    "- Surface textures and material rendering style\n\n" +
    "WHAT YOU MUST NEVER CHANGE:\n" +
    "- Position of ANY object\n" +
    "- Size or scale of ANY element\n" +
    "- Camera angle or perspective\n" +
    "- Composition or framing\n" +
    "- Architectural details, text, signs\n" +
    "- Number or arrangement of objects (cars, people, trees)\n\n" +
    "Think of this as applying an Instagram filter to the TARGET image - the content stays 100% identical, only the mood/style changes.\n\n" +
    "Additional style instructions:\n" + instructionText.substring(0, MAX_PROMPT_LENGTH);
}

function buildMessages(action: string, body: any, referenceImage: string | undefined, editImage: string | undefined, editInstruction: string | undefined, prompt: string | undefined): any[] {
  if (action === "generate") {
    const content: any[] = [
      {
        type: "text",
        text: "Based on the following detailed prompt, generate a new image that captures all the described elements. Use the reference image as visual guidance for style and composition.\n\nPrompt:\n" + (prompt || "").substring(0, MAX_PROMPT_LENGTH),
      },
    ];
    if (referenceImage) {
      content.push({ type: "image_url", image_url: { url: referenceImage } });
    }
    return [{ role: "user", content }];
  }

  if (action === "edit") {
    const hasReference = referenceImage && validateImageData(referenceImage);
    const instructionText = editInstruction || "Improve and enhance this image while keeping the same composition and style.";
    const editContent: any[] = [];

    if (hasReference) {
      editContent.push(
        { type: "text", text: buildEditPromptWithReference(instructionText) },
        { type: "text", text: "=== IMAGE 1: THIS IS THE TARGET IMAGE — YOU MUST EDIT THIS ONE. PRESERVE ITS EXACT COMPOSITION, OBJECTS, POSITIONS, AND ASPECT RATIO ===" },
        { type: "image_url", image_url: { url: editImage } },
        { type: "text", text: "=== IMAGE 2: THIS IS THE STYLE REFERENCE ONLY — DO NOT COPY ITS CONTENT, COMPOSITION, OR ASPECT RATIO. USE IT ONLY FOR MOOD, LIGHTING, AND COLOR STYLE ===" },
        { type: "image_url", image_url: { url: referenceImage } }
      );
    } else {
      editContent.push(
        { type: "text", text: "Edit this image while preserving its exact composition, subject, proportions, and structural details. Only apply the following changes:\n\n" + instructionText.substring(0, MAX_PROMPT_LENGTH) },
        { type: "image_url", image_url: { url: editImage } }
      );
    }
    return [{ role: "user", content: editContent }];
  }

  if (action === "upscale") {
    const scale = body.scale || 2;
    const upscaleContent: any[] = [
      {
        type: "text",
        text: `You are a high-end AI super-resolution and image enhancement expert. Your task is to perform a ${scale}x upscale on this image, transforming it into a high-fidelity, professional-grade result.
        
        STRICT ENHANCEMENT RULES:
        1. CONTENT FIDELITY: Maintain the EXACT composition, subjects, colors, and lighting. Do NOT add new objects or change the scene.
        2. SHARPNESS & CLARITY: Dramatically increase edge sharpness. Remove all noise, compression artifacts, and blurriness.
        3. TEXTURE SYNTHESIS: Generate realistic, high-frequency micro-textures that would be visible at high resolution (e.g., fine stone grain, wood fibers, fabric weave, intricate leaf veins, sharp architectural edges).
        4. DETAIL RECOVERY: Enhance small details like reflections in glass, shadows, and distant objects to make them crisp and well-defined.
        5. LITHOGRAPHY & TEXT: If there is any text or logos, make them perfectly legible and sharp.
        6. PROFESSIONAL FINISH: The final result must look like a native high-resolution photograph taken with a high-end 8K camera, not an AI-scaled image.
        
        Output only the enhanced ${scale}x image.`
      },
      { type: "image_url", image_url: { url: editImage } },
    ];
    return [{ role: "user", content: upscaleContent }];
  }

  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "طلب غير صالح" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt, referenceImage, editImage, editInstruction, model, action, customApi } = body;

    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ error: "إجراء غير صالح" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate" && prompt && (typeof prompt !== "string" || prompt.length > MAX_PROMPT_LENGTH)) {
      return new Response(JSON.stringify({ error: "النص طويل جداً" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "edit" && editInstruction && (typeof editInstruction !== "string" || editInstruction.length > MAX_PROMPT_LENGTH)) {
      return new Response(JSON.stringify({ error: "تعليمات التعديل طويلة جداً" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (referenceImage && !validateImageData(referenceImage)) {
      return new Response(JSON.stringify({ error: "الصورة المرجعية غير صالحة أو كبيرة جداً" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((action === "edit" || action === "upscale") && (!editImage || !validateImageData(editImage))) {
      const errMsg = action === "edit" ? "لا توجد صورة للتعديل" : "لا توجد صورة لتكبيرها";
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiConfig = getApiConfig(customApi);
    const selectedModel = (typeof model === "string" && model.length < 100) ? model : "google/gemini-2.5-flash-image";

    const messages = buildMessages(action, body, referenceImage, editImage, editInstruction, prompt);

    const FALLBACK_MODEL = "google/gemini-2.5-flash-image";
    const modelsToTry: string[] = [selectedModel];
    if (selectedModel !== FALLBACK_MODEL) modelsToTry.push(FALLBACK_MODEL);

    let imageUrl: string | undefined;
    let text = "";
    let lastProviderError: string | null = null;

    for (const tryModel of modelsToTry) {
      const response = await fetch(apiConfig.url, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiConfig.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: tryModel,
          messages,
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "تم تجاوز الحد المسموح، حاول لاحقاً" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "يرجى إضافة رصيد للاستمرار" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error("AI API error:", response.status, "model:", tryModel);
        lastProviderError = `AI API error ${response.status}`;
        continue;
      }

      const aiResponse = await response.json();
      console.log("AI response structure (model:", tryModel, "):", JSON.stringify(aiResponse).substring(0, 500));
      const choice = aiResponse.choices?.[0];
      const message = choice?.message;

      // Detect provider-level error embedded in choice
      if (choice?.error) {
        console.error("Provider error for model", tryModel, ":", JSON.stringify(choice.error));
        lastProviderError = choice.error?.metadata?.error_type || choice.error?.message || "provider_error";
        continue; // try fallback model
      }

      imageUrl = message?.images?.[0]?.image_url?.url;

      if (!imageUrl && Array.isArray(message?.content)) {
        const imgPart = message.content.find((p: any) => p.type === "image_url" || p.type === "image");
        if (imgPart) imageUrl = imgPart.image_url?.url || imgPart.url;
      }
      if (!imageUrl && Array.isArray(message?.content)) {
        const imgPart = message.content.find((p: any) => p.type === "image" && p.source?.data);
        if (imgPart) imageUrl = `data:${imgPart.source.media_type || "image/png"};base64,${imgPart.source.data}`;
      }

      text = typeof message?.content === "string" ? message.content : "";

      if (imageUrl) break; // success
      console.error("No image from model", tryModel, "— full response:", JSON.stringify(aiResponse).substring(0, 1500));
      lastProviderError = "no_image_in_response";
    }

    if (!imageUrl) {
      const isProviderDown = lastProviderError === "provider_unavailable" || (lastProviderError && lastProviderError.includes("502"));
      const errMsg = isProviderDown
        ? "نموذج التوليد غير متاح حالياً، حاول لاحقاً أو اختر نموذجاً آخر"
        : "لم يتم توليد صورة، حاول مجدداً";
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ image: imageUrl, text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(
      JSON.stringify({ error: getSafeErrorMessage(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

