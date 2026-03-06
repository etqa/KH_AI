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
  return "CRITICAL INSTRUCTIONS - READ CAREFULLY:\n\n" +
    "I am providing TWO images below:\n" +
    "- IMAGE 1 (FIRST): The TARGET image - this is the ONLY image you must edit.\n" +
    "- IMAGE 2 (SECOND): A style/mood reference ONLY - do NOT copy its content, subject, composition, or structure.\n\n" +
    "RULES:\n" +
    "1. PRESERVE the TARGET image's exact subject, composition, proportions, perspective, and all structural details.\n" +
    "2. The target image's content must remain IDENTICAL - same objects, same layout, same scale.\n" +
    "3. From the reference image, ONLY extract: color palette, lighting mood, atmosphere, artistic style, texture treatment.\n" +
    "4. Apply ONLY the style/mood aspects to the target image while keeping everything else unchanged.\n" +
    "5. The output image MUST look like the TARGET image with a style filter applied, NOT like the reference image.\n" +
    "6. CRITICAL: The output MUST have the EXACT same aspect ratio and dimensions as the TARGET image (IMAGE 1). IGNORE the reference image's aspect ratio completely.\n" +
    "7. Maintain the same level of detail as the target image.\n\n" +
    "Style instructions to apply:\n" + instructionText.substring(0, MAX_PROMPT_LENGTH);
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
        { type: "image_url", image_url: { url: editImage } },
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
        text: "You are an image upscaling expert. Your task is to recreate this EXACT image at " + scale + "x higher resolution with dramatically enhanced details.\n\n" +
          "STRICT RULES:\n" +
          "1. The output MUST be the EXACT same image - same subject, composition, colors, lighting, perspective. Change NOTHING about the content.\n" +
          "2. ADD fine details that would exist at higher resolution: skin pores, hair strands, fabric weave, wood grain, leaf veins, text sharpness.\n" +
          "3. SHARPEN all edges and textures - remove any blur or softness from the original.\n" +
          "4. ENHANCE micro-details: reflections, shadows, surface textures, material properties.\n" +
          "5. Maintain the EXACT same aspect ratio and framing.\n" +
          "6. The result should look like it was originally captured with a much higher resolution camera.\n" +
          "7. Make text, logos, and fine patterns crisp and readable.\n" +
          "8. Output the highest quality, most detailed version possible.",
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

    const response = await fetch(apiConfig.url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiConfig.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
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
      console.error("AI API error:", response.status);
      throw new Error("AI API error");
    }

    const aiResponse = await response.json();
    const message = aiResponse.choices?.[0]?.message;
    const imageUrl = message?.images?.[0]?.image_url?.url;
    const text = message?.content || "";

    if (!imageUrl) {
      throw new Error("No image generated");
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
