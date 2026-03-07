import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_PROVIDERS = ["google", "openai", "custom"];
const ALLOWED_MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "google/gemini-3-pro-preview",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB in base64 chars (~7.5MB actual)
const ALLOWED_OPTIONS = [
  "Composition", "Lighting", "Color Palette",
  "Mood & Atmosphere", "Subject Details", "Technical Settings",
  "Background", "Textures", "Perspective", "Style",
];

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("API_KEY") || error.message.includes("configured")) {
      return "خطأ في إعداد الخدمة";
    }
    if (error.message.includes("AI API")) return "خدمة الذكاء الاصطناعي غير متاحة مؤقتاً";
    if (error.message.includes("No content")) return "لم يتم الحصول على نتيجة، حاول مجدداً";
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
  throw new Error("يجب إدخال مفتاح API في الإعدادات");
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

    const { image, options, model, customApi } = body;

    // Validate image
    if (!image || typeof image !== "string") {
      return new Response(JSON.stringify({ error: "لم يتم توفير صورة" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (image.length > MAX_IMAGE_SIZE) {
      return new Response(JSON.stringify({ error: "حجم الصورة كبير جداً (الحد 10MB)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate options
    if (!Array.isArray(options) || options.length === 0 || options.length > 20) {
      return new Response(JSON.stringify({ error: "خيارات غير صالحة" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const safeOptions = options.filter((o: any) => typeof o === "string" && o.length < 100);
    if (safeOptions.length === 0) {
      return new Response(JSON.stringify({ error: "خيارات غير صالحة" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate model
    const selectedModel = (typeof model === "string" && ALLOWED_MODELS.includes(model)) ? model : "google/gemini-3-flash-preview";

    const apiConfig = getApiConfig(customApi);

    const enabledOptions = safeOptions as string[];
    const sectionsJson = enabledOptions.map(opt => `"${opt.replace(/"/g, '')}": {"ar": "...", "en": "..."}`).join(", ");

    const systemPrompt = `You are an expert image prompt engineer. Analyze the provided image and generate a detailed, professional prompt.

Start with a creative title and overview, then provide detailed analysis for EACH of these sections: ${enabledOptions.join(", ")}

IMPORTANT: Return your response in EXACTLY this JSON format (no markdown, no code blocks):
{
  "titleAr": "عنوان إبداعي بالعربية",
  "titleEn": "Creative English Title",
  "overviewAr": "وصف عام شامل بالعربية",
  "overviewEn": "Comprehensive overview in English",
  "sections": {${sectionsJson}}
}

For each section, provide a rich, detailed paragraph (3-5 sentences minimum) with technical terminology.
The Arabic text should be professional and use proper Arabic photography/art terms.
The English text should be professional and include technical terms suitable for AI image generation prompts like Midjourney, DALL-E, or Stable Diffusion.
Be extremely detailed and specific about what you observe in the image.`;

    const base64Match = image.match(/^data:image\/([^;]+);base64,(.+)$/);
    if (!base64Match) {
      return new Response(JSON.stringify({ error: "صيغة الصورة غير صالحة" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mimeType = `image/${base64Match[1]}`;
    const base64Data = base64Match[2];

    const response = await fetch(apiConfig.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } },
              { type: "text", text: "Analyze this image and generate detailed prompts in both Arabic and English based on the specified options." },
            ],
          },
        ],
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
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*"titleAr"[\s\S]*"sections"[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = {
          titleAr: "تحليل الصورة",
          titleEn: "Image Analysis",
          overviewAr: content,
          overviewEn: content,
          sections: {},
        };
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-image error:", e);
    return new Response(
      JSON.stringify({ error: getSafeErrorMessage(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
