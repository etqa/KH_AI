import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getApiConfig(customApi: any) {
  if (customApi && customApi.provider && customApi.apiKey) {
    switch (customApi.provider) {
      case "google":
        return {
          url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          apiKey: customApi.apiKey,
        };
      case "openai":
        return {
          url: "https://api.openai.com/v1/chat/completions",
          apiKey: customApi.apiKey,
        };
      case "custom":
        return {
          url: customApi.apiUrl || "https://api.openai.com/v1/chat/completions",
          apiKey: customApi.apiKey,
        };
    }
  }
  // Default: Lovable AI
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }
  return {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    apiKey: LOVABLE_API_KEY,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, options, model, customApi } = await req.json();

    if (!image) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiConfig = getApiConfig(customApi);

    const enabledOptions = options as string[];
    const sectionsJson = enabledOptions.map(opt => `"${opt}": {"ar": "...", "en": "..."}`).join(", ");

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
      return new Response(JSON.stringify({ error: "Invalid image format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        model: model || "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`,
                },
              },
              {
                type: "text",
                text: "Analyze this image and generate detailed prompts in both Arabic and English based on the specified options.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز الحد المسموح، حاول لاحقاً" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "يرجى إضافة رصيد للاستمرار" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
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
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
