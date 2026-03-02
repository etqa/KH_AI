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
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [reEditedImage, setReEditedImage] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [reEditingImage, setReEditingImage] = useState(false);
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
    setGeneratedImage(null);
    setReEditedImage(null);

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
          editInstruction: `Use this reference image style and the following prompt to edit and transform the provided image:\n\n${fullPrompt}`,
          referenceImage: image,
          model: imageModel,
        },
      });

      if (error) throw error;

      setGeneratedImage(data.image);
      toast.success("تم توليد الصورة بنجاح! 🎨");
    } catch (err: any) {
      console.error("Error generating image:", err);
      toast.error(err.message || "حدث خطأ أثناء توليد الصورة");
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleReEditImage = async () => {
    if (!generatedImage || !editInstruction) return;

    setReEditingImage(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: {
          action: "edit",
          editImage: generatedImage,
          editInstruction,
          model: imageModel,
        },
      });

      if (error) throw error;

      setReEditedImage(data.image);
      toast.success("تم تعديل الصورة بنجاح! ✏️");
    } catch (err: any) {
      console.error("Error re-editing image:", err);
      toast.error(err.message || "حدث خطأ أثناء تعديل الصورة");
    } finally {
      setReEditingImage(false);
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

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 md:py-16">
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

        {/* Two images side by side */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Right: Reference Image + Prompt Model */}
            <div className="flex flex-col gap-3">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <span>📸</span>
                <span>الصورة المرجعية</span>
              </h3>
              <ImageUploader image={image} onImageChange={setImage} />
              <ModelSelector value={model} onChange={setModel} />
            </div>

            {/* Left: Original Image to Edit + Image Model */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <span>🖼️</span>
                  <span>الصورة الأصلية للتعديل</span>
                </h3>
                {originalImage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-lg text-xs"
                    onClick={() => { setOriginalImage(null); setGeneratedImage(null); setReEditedImage(null); }}
                  >
                    <X className="h-3.5 w-3.5 ml-1" />
                    تغيير
                  </Button>
                )}
              </div>
              {originalImage ? (
                <div className="rounded-2xl overflow-hidden gradient-border">
                  <img src={originalImage} alt="Original" className="w-full max-h-[400px] object-contain bg-card rounded-2xl" />
                </div>
              ) : (
                <ImageUploader image={originalImage} onImageChange={setOriginalImage} />
              )}
              <ImageModelSelector value={imageModel} onChange={setImageModel} />
            </div>
          </div>
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

            {/* Two result containers side by side */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10"
            >
              <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                🖼️ نتائج التوليد والتعديل
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Container 1: Generated from prompt + reference */}
                <ImageContainer
                  label="النتيجة المولّدة"
                  emoji="🎨"
                  image={generatedImage}
                  loading={generatingImage}
                  actionLabel="تطبيق البرومت على الصورة"
                  actionIcon="generate"
                  onAction={handleGenerateEditedImage}
                  disabled={!originalImage || !prompt}
                />

                {/* Container 2: Re-edited result */}
                <div className="flex flex-col gap-3">
                  <ImageContainer
                    label="النتيجة بعد التعديل"
                    emoji="✏️"
                    image={reEditedImage}
                    loading={reEditingImage}
                    actionLabel="تعديل الصورة المولّدة"
                    actionIcon="edit"
                    onAction={handleReEditImage}
                    disabled={!generatedImage || !editInstruction}
                  />
                  {generatedImage && (
                    <Textarea
                      value={editInstruction}
                      onChange={(e) => setEditInstruction(e.target.value)}
                      placeholder="أدخل تعليمات التعديل... مثال: اجعل الألوان أكثر دفئاً، أضف غروب الشمس..."
                      className="rounded-xl bg-background/50 border-border/30 text-sm min-h-[80px]"
                      dir="rtl"
                    />
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
