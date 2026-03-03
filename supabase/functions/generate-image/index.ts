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
    const { prompt, referenceImage, editImage, editInstruction, model, action, customApi } = await req.json();

    const apiConfig = getApiConfig(customApi);
    const selectedModel = model || "google/gemini-2.5-flash-image";

    let messages: any[];

    if (action === "generate") {
      const content: any[] = [
        {
          type: "text",
          text: `Based on the following detailed prompt, generate a new image that captures all the described elements. Use the reference image as visual guidance for style and composition.\n\nPrompt:\n${prompt}`,
        },
      ];
      if (referenceImage) {
        content.push({
          type: "image_url",
          image_url: { url: referenceImage },
        });
      }
      messages = [{ role: "user", content }];
    } else if (action === "edit") {
      if (!editImage) {
        return new Response(JSON.stringify({ error: "No image to edit" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const editContent: any[] = [
        {
          type: "text",
          text: editInstruction || "Improve and enhance this image while keeping the same composition and style.",
        },
        {
          type: "image_url",
          image_url: { url: editImage },
        },
      ];
      if (referenceImage) {
        editContent.push({
          type: "image_url",
          image_url: { url: referenceImage },
        });
      }
      messages = [{ role: "user", content: editContent }];
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      throw new Error(`AI API error: ${response.status}`);
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
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
