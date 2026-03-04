import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_PROVIDERS = ["google", "openai", "custom"];
const ALLOWED_ACTIONS = ["generate", "edit"];
const MAX_PROMPT_LENGTH = 5000;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

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

    // Validate action
    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ error: "إجراء غير صالح" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate prompt
    if (action === "generate" && prompt && (typeof prompt !== "string" || prompt.length > MAX_PROMPT_LENGTH)) {
      return new Response(JSON.stringify({ error: "النص طويل جداً" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate edit instruction
    if (action === "edit" && editInstruction && (typeof editInstruction !== "string" || editInstruction.length > MAX_PROMPT_LENGTH)) {
      return new Response(JSON.stringify({ error: "تعليمات التعديل طويلة جداً" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate images
    if (referenceImage && !validateImageData(referenceImage)) {
      return new Response(JSON.stringify({ error: "الصورة المرجعية غير صالحة أو كبيرة جداً" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiConfig = getApiConfig(customApi);
    const selectedModel = (typeof model === "string" && model.length < 100) ? model : "google/gemini-2.5-flash-image";

    let messages: any[];

    if (action === "generate") {
      const content: any[] = [
        {
          type: "text",
          text: `Based on the following detailed prompt, generate a new image that captures all the described elements. Use the reference image as visual guidance for style and composition.\n\nPrompt:\n${(prompt || "").substring(0, MAX_PROMPT_LENGTH)}`,
        },
      ];
      if (referenceImage) {
        content.push({ type: "image_url", image_url: { url: referenceImage } });
      }
      messages = [{ role: "user", content }];
    } else {
      if (!editImage || !validateImageData(editImage)) {
        return new Response(JSON.stringify({ error: "لا توجد صورة للتعديل" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const editContent: any[] = [
        {
          type: "text",
          text: (editInstruction || "Improve and enhance this image while keeping the same composition and style.").substring(0, MAX_PROMPT_LENGTH),
        },
        { type: "image_url", image_url: { url: editImage } },
      ];
      if (referenceImage) {
        editContent.push({ type: "image_url", image_url: { url: referenceImage } });
      }
      messages = [{ role: "user", content: editContent }];
    }

    const response = await fetch(apiConfig.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiConfig.apiKey}`,
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
