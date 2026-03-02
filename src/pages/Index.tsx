import { useState, useCallback } from "react";
import { Sparkles, Loader2, X } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ImageUploader from "@/components/ImageUploader";
import PromptOptions, { defaultOptions, type PromptOption } from "@/components/PromptOptions";
import PromptResult, { type StructuredPrompt } from "@/components/PromptResult";
import ModelSelector from "@/components/ModelSelector";
import ImageModelSelector from "@/components/ImageModelSelector";
import ImageContainer from "@/components/ImageContainer";

const Index = () => {
  const [image, setImage] = useState<string | null>(null);
  const [options, setOptions] = useState<PromptOption[]>(defaultOptions);
  const [prompt, setPrompt] = useState<StructuredPrompt | null>(null);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("google/gemini-3-flash-preview");
  const [imageModel, setImageModel] = useState("google/gemini-2.5-flash-image");

  // Image generation states
  const [originalImage, setOriginalImage] = useState<string | null>(null); // User's image to edit
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [editInstruction, setEditInstruction] = useState("");

  const handleToggle = useCallback((id: string) => {
    setOptions((prev) =>
      prev.map((opt) => (opt.id === id ? { ...opt, enabled: !opt.enabled } : opt))
    );
  }, []);

  const buildFullPrompt = (p: StructuredPrompt, lang: "en" | "ar") => {
    const title = lang === "ar" ? p.titleAr : p.titleEn;
    const overview = lang === "ar" ? p.overviewAr : p.overviewEn;
    let text = `${title}\n${overview}\n\n`;
    for (const [key, section] of Object.entries(p.sections)) {
      text += `${key}\n${section[lang]}\n\n`;
    }
    return text.trim();
  };

  const handleGenerate = async () => {
    if (!image) {
      toast.error("الرجاء رفع صورة أولاً");
      return;
    }

    const enabledOptions = options.filter((o) => o.enabled).map((o) => o.labelEn);
    if (enabledOptions.length === 0) {
      toast.error("الرجاء تفعيل خيار واحد على الأقل");
      return;
    }

    setLoading(true);
    setPrompt(null);
    setEditedImage(null);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-image", {
        body: { image, options: enabledOptions, model },
      });

      if (error) throw error;

      setPrompt(data as StructuredPrompt);
      toast.success("تم إنشاء البرومت بنجاح! ✨");
    } catch (err: any) {
      console.error("Error generating prompt:", err);
      toast.error(err.message || "حدث خطأ أثناء إنشاء البرومت");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEditedImage = async () => {
    if (!prompt || !originalImage) return;

    setGeneratingImage(true);
    try {
      const fullPrompt = buildFullPrompt(prompt, "en");
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: {
          action: "edit",
          editImage: originalImage,
          editInstruction: `Use this reference image style and the following prompt to edit and transform the provided image:\n\n${fullPrompt}${editInstruction ? `\n\nAdditional instructions: ${editInstruction}` : ""}`,
          referenceImage: image,
          model: imageModel,
        },
      });

      if (error) throw error;

      setEditedImage(data.image);
      toast.success("تم تعديل الصورة بنجاح! 🎨");
    } catch (err: any) {
      console.error("Error generating edited image:", err);
      toast.error(err.message || "حدث خطأ أثناء تعديل الصورة");
    } finally {
      setGeneratingImage(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg" dir="rtl">
      {/* Decorative orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 rounded-full bg-secondary/10 blur-[120px]" />
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 rounded-full bg-accent/10 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-8 md:py-16">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl md:text-5xl font-black gradient-text mb-3">
            وصف الصورة
          </h1>
          <p className="text-muted-foreground text-base md:text-lg">
            حلّل صورتك بالذكاء الاصطناعي واحصل على برومت احترافي جاهز للاستخدام
          </p>
        </motion.header>

        {/* Image Upload */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <ImageUploader image={image} onImageChange={setImage} />
        </motion.section>

        {/* Options */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            ⚙️ خيارات البرومت
          </h2>
          <div className="mb-4">
            <ModelSelector value={model} onChange={setModel} />
          </div>
          <PromptOptions options={options} onToggle={handleToggle} />
        </motion.section>

        {/* Generate Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <Button
            onClick={handleGenerate}
            disabled={loading || !image}
            className="w-full h-14 text-lg font-bold rounded-xl bg-gradient-to-l from-primary via-secondary to-accent hover:opacity-90 transition-opacity text-primary-foreground shadow-lg shadow-primary/25"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin ml-2" />
                جارِ التحليل...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 ml-2" />
                إنشاء البرومت
              </>
            )}
          </Button>
        </motion.div>

        {/* Results */}
        {prompt && (
          <>
            <PromptResult prompt={prompt} />

            {/* Image Generation Section */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10"
            >
              <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                🖼️ إنشاء وتعديل الصور
              </h2>

              {/* Image Model Selector */}
              <div className="mb-6">
                <ImageModelSelector value={imageModel} onChange={setImageModel} />
              </div>

              {/* 3 Image Containers */}
              <div className="grid grid-cols-1 gap-4">
                {/* Container 1: Reference Image */}
                <ImageContainer
                  label="الصورة المرجعية"
                  emoji="📸"
                  image={image}
                />

                {/* Container 2: Original Image to Edit (user uploads) */}
                <div>
                  <ImageContainer
                    label="الصورة الأصلية للتعديل"
                    emoji="🖼️"
                    image={originalImage}
                  />
                  {!originalImage && (
                    <div className="mt-3">
                      <ImageUploader image={originalImage} onImageChange={setOriginalImage} />
                    </div>
                  )}
                  {originalImage && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => { setOriginalImage(null); setEditedImage(null); }}
                      >
                        <X className="h-4 w-4 ml-1" />
                        تغيير الصورة
                      </Button>
                    </div>
                  )}
                </div>

                {/* Container 3: Edited Result */}
                <div>
                  <ImageContainer
                    label="النتيجة بعد التعديل"
                    emoji="✨"
                    image={editedImage}
                    loading={generatingImage}
                    actionLabel="تطبيق البرومت على الصورة"
                    actionIcon="generate"
                    onAction={handleGenerateEditedImage}
                    disabled={!originalImage || !prompt}
                  />
                  {originalImage && (
                    <div className="mt-3">
                      <Textarea
                        value={editInstruction}
                        onChange={(e) => setEditInstruction(e.target.value)}
                        placeholder="تعليمات إضافية (اختياري)... مثال: اجعل الألوان أكثر دفئاً..."
                        className="rounded-xl bg-background/50 border-border/30 text-sm min-h-[80px]"
                        dir="rtl"
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.section>
          </>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-xs text-muted-foreground">
          مجاني بالكامل • مدعوم بالذكاء الاصطناعي ✨
        </footer>
      </div>
    </div>
  );
};

export default Index;
