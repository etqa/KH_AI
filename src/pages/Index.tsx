import { useState, useCallback, useRef } from "react";
import { Sparkles, Loader2, X, ChevronDown, ChevronUp, Wand2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
import SettingsDialog from "@/components/SettingsDialog";
import ImageViewer from "@/components/ImageViewer";
import UpscaleSection from "@/components/UpscaleSection";
import { useSettings } from "@/hooks/useSettings";
import { FunctionsHttpError } from "@supabase/supabase-js";

async function extractErrorMessage(err: any, fallback: string): Promise<string> {
  if (err instanceof FunctionsHttpError) {
    try {
      const body = await err.context.json();
      if (body?.error) return body.error;
    } catch { /* ignore */ }
  }
  if (err?.message && !err.message.includes("non-2xx")) return err.message;
  return fallback;
}

const Index = () => {
  const { settings, updateSettings, getActiveApiKey } = useSettings();
  const [image, setImage] = useState<string | null>(null);
  const [options, setOptions] = useState<PromptOption[]>(defaultOptions);
  const [prompt, setPrompt] = useState<StructuredPrompt | null>(null);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("google/gemini-3-flash-preview");
  const [imageModel, setImageModel] = useState("google/gemini-2.5-flash-image");
  const [optionsOpen, setOptionsOpen] = useState(true);
  const [promptOpen, setPromptOpen] = useState(true);

  // Image generation states
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [reEditedImage, setReEditedImage] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [reEditingImage, setReEditingImage] = useState(false);
  const [editInstruction, setEditInstruction] = useState("");
  const [promptLang, setPromptLang] = useState<"ar" | "en">("ar");

  // Image viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  // Drag state
  const dragSourceRef = useRef<string | null>(null);

  const handleToggle = useCallback((id: string) => {
    setOptions((prev) =>
      prev.map((opt) => (opt.id === id ? { ...opt, enabled: !opt.enabled } : opt))
    );
  }, []);

  const getImageDimensions = (imgSrc: string): Promise<{width: number; height: number}> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = imgSrc;
    });
  };

  const cropToAspectRatio = (imgSrc: string, targetWidth: number, targetHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const targetRatio = targetWidth / targetHeight;
        const srcRatio = img.naturalWidth / img.naturalHeight;
        
        let cropX = 0, cropY = 0, cropW = img.naturalWidth, cropH = img.naturalHeight;
        
        if (Math.abs(srcRatio - targetRatio) < 0.01) {
          resolve(imgSrc);
          return;
        }
        
        if (srcRatio > targetRatio) {
          cropW = Math.round(img.naturalHeight * targetRatio);
          cropX = Math.round((img.naturalWidth - cropW) / 2);
        } else {
          cropH = Math.round(img.naturalWidth / targetRatio);
          cropY = Math.round((img.naturalHeight - cropH) / 2);
        }
        
        const canvas = document.createElement("canvas");
        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas error")); return; }
        
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = imgSrc;
    });
  };

  const buildFullPrompt = (p: StructuredPrompt, lang: "en" | "ar") => {
    const title = lang === "ar" ? p.titleAr : p.titleEn;
    const overview = lang === "ar" ? p.overviewAr : p.overviewEn;
    let text = `${title}\n${overview}\n\n`;
    for (const [key, section] of Object.entries(p.sections)) {
      text += `${key}\n${section[lang]}\n\n`;
    }
    return text.trim();
  };

  // All viewable images for the viewer
  const allImages = [
    { src: image || "", label: "الصورة المرجعية" },
    { src: originalImage || "", label: "الصورة الأصلية" },
    { src: generatedImage || "", label: "النتيجة المولّدة" },
    { src: reEditedImage || "", label: "النتيجة المعدّلة" },
  ].filter((img) => img.src);

  const openViewer = (imageSrc: string) => {
    const idx = allImages.findIndex((img) => img.src === imageSrc);
    setViewerInitialIndex(idx >= 0 ? idx : 0);
    setViewerOpen(true);
  };

  // Container image map for drag-and-drop
  const containerImageMap: Record<string, { get: () => string | null; set: (v: string | null) => void }> = {
    reference: { get: () => image, set: setImage },
    generated: { get: () => generatedImage, set: setGeneratedImage },
    reedited: { get: () => reEditedImage, set: setReEditedImage },
  };

  const handleDragStart = (containerId: string) => {
    dragSourceRef.current = containerId;
  };

  const handleDrop = (targetId: string) => {
    const sourceId = dragSourceRef.current;
    if (!sourceId || sourceId === targetId) return;

    const sourceEntry = containerImageMap[sourceId];
    const targetEntry = containerImageMap[targetId];
    if (!sourceEntry || !targetEntry) return;

    const sourceImg = sourceEntry.get();
    const targetImg = targetEntry.get();

    targetEntry.set(sourceImg);
    sourceEntry.set(targetImg);

    toast.success("تم تبديل الصور ✅");
    dragSourceRef.current = null;
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
      const customApi = getActiveApiKey();
      const { data, error } = await supabase.functions.invoke("analyze-image", {
        body: { image, options: enabledOptions, model, customApi },
      });
      if (error) throw error;
      setPrompt(data as StructuredPrompt);
      toast.success("تم إنشاء البرومت بنجاح! ✨");
    } catch (err: any) {
      console.error("Error generating prompt:", err);
      const msg = await extractErrorMessage(err, "حدث خطأ أثناء إنشاء البرومت");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEditedImage = async () => {
    if (!prompt || !originalImage) {
      toast.error("الرجاء رفع صورة أولاً في حاوية التوليد");
      return;
    }
    setGeneratingImage(true);
    try {
      const fullPrompt = buildFullPrompt(prompt, promptLang);
      const customApi = getActiveApiKey();
      
      // Get original image dimensions to preserve aspect ratio
      const imgDims = await getImageDimensions(originalImage);
      const aspectNote = imgDims 
        ? `\n\nCRITICAL: The output image MUST have the EXACT same aspect ratio as the target image (${imgDims.width}x${imgDims.height}, ratio ${(imgDims.width/imgDims.height).toFixed(3)}). Do NOT use the reference image's aspect ratio or dimensions.`
        : "";
      
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: {
          action: "edit",
          editImage: originalImage,
          editInstruction: `Apply ONLY the visual style described below to the target image. Do NOT change any object positions, sizes, or structural details. The output must look like the exact same photo with a style filter applied.\n\nStyle to apply:\n${fullPrompt}${aspectNote}`,
          referenceImage: image,
          model: imageModel,
          customApi,
        },
      });
      if (error) throw error;
      // Crop generated image to match original aspect ratio
      const croppedImage = await cropToAspectRatio(data.image, imgDims.width, imgDims.height);
      setGeneratedImage(croppedImage);
      toast.success("تم توليد الصورة بنجاح! 🎨");
    } catch (err: any) {
      console.error("Error generating image:", err);
      const msg = await extractErrorMessage(err, "حدث خطأ أثناء توليد الصورة");
      toast.error(msg);
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleReEditImage = async () => {
    if (!generatedImage || !editInstruction) return;
    setReEditingImage(true);
    try {
      const customApi = getActiveApiKey();
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: {
          action: "edit",
          editImage: generatedImage,
          editInstruction,
          model: imageModel,
          customApi,
        },
      });
      if (error) throw error;
      setReEditedImage(data.image);
      toast.success("تم تعديل الصورة بنجاح! ✏️");
    } catch (err: any) {
      console.error("Error re-editing image:", err);
      const msg = await extractErrorMessage(err, "حدث خطأ أثناء تعديل الصورة");
      toast.error(msg);
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
          <div className="flex items-center justify-center gap-3 mb-3">
            <h1 className="text-4xl md:text-5xl font-black gradient-text">
              وصف الصورة
            </h1>
            <SettingsDialog settings={settings} onUpdate={updateSettings} />
          </div>
          <p className="text-muted-foreground text-base md:text-lg">
            حلّل صورتك بالذكاء الاصطناعي واحصل على برومت احترافي جاهز للاستخدام
          </p>
        </motion.header>

        {/* Reference Image Only */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex flex-col gap-3">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <span>📸</span>
              <span>الصورة المرجعية</span>
            </h3>
            <ImageUploader image={image} onImageChange={setImage} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ModelSelector value={model} onChange={setModel} />
              <ImageModelSelector value={imageModel} onChange={setImageModel} />
            </div>
          </div>
        </motion.section>

        {/* Collapsible Options */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <button
            onClick={() => setOptionsOpen(!optionsOpen)}
            className="w-full flex items-center justify-between text-lg font-bold text-foreground mb-4 hover:text-primary transition-colors"
          >
            <span className="flex items-center gap-2">⚙️ خيارات البرومت</span>
            {optionsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          <AnimatePresence>
            {optionsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <PromptOptions options={options} onToggle={handleToggle} />
              </motion.div>
            )}
          </AnimatePresence>
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

        {/* Collapsible Prompt Result */}
        {prompt && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <button
              onClick={() => setPromptOpen(!promptOpen)}
              className="w-full flex items-center justify-between text-lg font-bold text-foreground mb-4 hover:text-primary transition-colors"
            >
              <span className="flex items-center gap-2">📝 البرومت</span>
              {promptOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
            <AnimatePresence>
              {promptOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <PromptResult prompt={prompt} onPromptChange={setPrompt} onActiveLangChange={setPromptLang} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}

        {/* Generation Results - Always visible */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            🖼️ نتائج التوليد والتعديل
          </h2>
          {/* Upload original image */}
          <div className="mb-4">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2 mb-3">
              <span>🖼️</span>
              <span>ارفع الصورة لتطبيق البرومت عليها</span>
            </h3>
            {originalImage ? (
              <div className="relative glass-card rounded-xl p-3 gradient-border">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 left-2 h-7 w-7 z-10 bg-background/60 backdrop-blur-sm rounded-full"
                  onClick={() => { setOriginalImage(null); }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <img
                  src={originalImage}
                  alt="Original"
                  className="w-full max-h-[250px] object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => openViewer(originalImage)}
                />
                <Button
                  onClick={handleGenerateEditedImage}
                  disabled={!prompt || generatingImage}
                  className="w-full mt-3 rounded-xl h-10 text-sm font-bold bg-gradient-to-l from-primary via-secondary to-accent hover:opacity-90 text-primary-foreground"
                >
                  {generatingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  ) : (
                    <Wand2 className="h-4 w-4 ml-2" />
                  )}
                  تطبيق البرومت على الصورة
                </Button>
              </div>
            ) : (
              <ImageUploader image={originalImage} onImageChange={setOriginalImage} />
            )}
          </div>

          {/* Results grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ImageContainer
              label="النتيجة المولّدة"
              emoji="🎨"
              image={generatedImage}
              loading={generatingImage}
              onImageClick={() => generatedImage && openViewer(generatedImage)}
              onImageReplace={setGeneratedImage}
              containerId="generated"
              onDragStart={handleDragStart}
              onDrop={handleDrop}
            />

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
                onImageClick={() => reEditedImage && openViewer(reEditedImage)}
                onImageReplace={setReEditedImage}
                containerId="reedited"
                onDragStart={handleDragStart}
                onDrop={handleDrop}
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

        {/* Upscale Section */}
        <UpscaleSection
          imageModel={imageModel}
          getActiveApiKey={getActiveApiKey}
          onImageClick={openViewer}
        />

        {/* Footer */}
        <footer className="mt-12 text-center text-xs text-muted-foreground">
          مجاني بالكامل • مدعوم بالذكاء الاصطناعي ✨
        </footer>
      </div>

      {/* Full-screen Image Viewer */}
      <ImageViewer
        images={allImages}
        initialIndex={viewerInitialIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
};

export default Index;
