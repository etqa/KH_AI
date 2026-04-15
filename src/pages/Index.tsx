import { useState, useCallback, useRef } from "react";
import { Sparkles, Loader2, X, ChevronDown, ChevronUp, Wand2, Settings, Camera, SlidersHorizontal, FileText, Images, Search, Palette, PenLine } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ImageUploader from "@/components/ImageUploader";
import MultiImageUploader from "@/components/MultiImageUploader";
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
  const { settings, activeAccount, setActiveAccount, addAccount, removeAccount, updateActiveAccount, getActiveApiKey } = useSettings();
  const [image, setImage] = useState<string | null>(null);
  const [options, setOptions] = useState<PromptOption[]>(defaultOptions);
  const [prompt, setPrompt] = useState<StructuredPrompt | null>(null);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("google/gemini-3-flash-preview");
  const [imageModel, setImageModel] = useState("google/gemini-2.5-flash-image");
  const [referenceOpen, setReferenceOpen] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(true);
  const [resultsOpen, setResultsOpen] = useState(true);
  const [upscaleOpen, setUpscaleOpen] = useState(false);

  // Image generation states
  const [originalImages, setOriginalImages] = useState<string[]>([]);
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [reEditedImage, setReEditedImage] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState({ current: 0, total: 0 });
  const [reEditingImage, setReEditingImage] = useState(false);
  const [editInstruction, setEditInstruction] = useState("");
  const [promptLang, setPromptLang] = useState<"ar" | "en">("ar");
  const [manualPrompt, setManualPrompt] = useState("");

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
  const generatedImagesArray = Object.values(generatedImages);
  const allImages = [
    { src: image || "", label: "الصورة المرجعية" },
    ...originalImages.map((img, i) => ({ src: img, label: `الصورة الأصلية ${i + 1}` })),
    ...generatedImagesArray.map((img, i) => ({ src: img, label: `النتيجة المولّدة ${i + 1}` })),
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
    setGeneratedImages({});
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
    if (!prompt || originalImages.length === 0) {
      toast.error("الرجاء رفع صورة واحدة على الأقل");
      return;
    }
    setGeneratingImage(true);
    setGeneratingProgress({ current: 0, total: originalImages.length });
    const results: Record<number, string> = {};
    try {
      const fullPrompt = buildFullPrompt(prompt, promptLang);
      const customApi = getActiveApiKey();

      for (let i = 0; i < originalImages.length; i++) {
        setGeneratingProgress({ current: i + 1, total: originalImages.length });
        try {
          const imgDims = await getImageDimensions(originalImages[i]);
          const aspectNote = imgDims
            ? `\n\nCRITICAL: The output image MUST have the EXACT same aspect ratio as the target image (${imgDims.width}x${imgDims.height}, ratio ${(imgDims.width/imgDims.height).toFixed(3)}). Do NOT use the reference image's aspect ratio or dimensions.`
            : "";

          const { data, error } = await supabase.functions.invoke("generate-image", {
            body: {
              action: "edit",
              editImage: originalImages[i],
              editInstruction: `Apply ONLY the visual style described below to the target image. Do NOT change any object positions, sizes, or structural details. The output must look like the exact same photo with a style filter applied.\n\nStyle to apply:\n${fullPrompt}${aspectNote}`,
              referenceImage: image,
              model: imageModel,
              customApi,
            },
          });
          if (error) throw error;
          const croppedImage = await cropToAspectRatio(data.image, imgDims.width, imgDims.height);
          results[i] = croppedImage;
          setGeneratedImages((prev) => ({ ...prev, [i]: croppedImage }));
        } catch (err: any) {
          console.error(`Error generating image ${i + 1}:`, err);
          const msg = await extractErrorMessage(err, `خطأ في الصورة ${i + 1}`);
          toast.error(msg);
        }
      }
      if (Object.keys(results).length > 0) {
        toast.success(`تم توليد ${Object.keys(results).length} من ${originalImages.length} صورة بنجاح! 🎨`);
      }
    } catch (err: any) {
      console.error("Error generating images:", err);
      const msg = await extractErrorMessage(err, "حدث خطأ أثناء توليد الصور");
      toast.error(msg);
    } finally {
      setGeneratingImage(false);
      setGeneratingProgress({ current: 0, total: 0 });
    }
  };

  const handleReEditImage = async () => {
    const firstGenerated = Object.values(generatedImages)[0];
    if (!firstGenerated || !editInstruction) return;
    setReEditingImage(true);
    try {
      const customApi = getActiveApiKey();
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: {
          action: "edit",
          editImage: firstGenerated,
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

  const handleApplyManualPrompt = useCallback(() => {
    const text = manualPrompt.trim();
    if (!text) return;
    const newPrompt: StructuredPrompt = {
      titleAr: text.split("\n")[0] || "برومت يدوي",
      titleEn: "Manual Prompt",
      overviewAr: text,
      overviewEn: text,
      sections: {},
    };
    setPrompt(newPrompt);
    toast.success("تم تطبيق البرومت! ✨");
  }, [manualPrompt]);

  return (
    <div className="min-h-screen gradient-bg" dir="rtl">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 h-14 flex items-center justify-between">
          <h1 className="text-xl font-bold gradient-text">Archives AI</h1>
          <SettingsDialog settings={settings} activeAccount={activeAccount} onUpdateAccount={updateActiveAccount} onSetActive={setActiveAccount} onAddAccount={addAccount} onRemoveAccount={removeAccount} />
        </div>
      </nav>

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
          <p className="text-muted-foreground text-base md:text-lg">
            حلّل صورتك بالذكاء الاصطناعي واحصل على برومت احترافي جاهز للاستخدام
          </p>
        </motion.header>

        {/* Reference Image - Collapsible */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden"
        >
          <button
            onClick={() => setReferenceOpen(!referenceOpen)}
            className="w-full flex items-center justify-between text-lg font-bold text-primary-foreground px-5 py-3.5 bg-gradient-to-l from-primary/80 via-secondary/70 to-accent/60 hover:from-primary hover:via-secondary hover:to-accent transition-all duration-200"
          >
            <span className="flex items-center gap-2"><Camera className="h-5 w-5" /> الصورة المرجعية</span>
            {referenceOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          <AnimatePresence>
            {referenceOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden p-4 space-y-3"
              >
                <ImageUploader image={image} onImageChange={setImage} />
                <ModelSelector value={model} onChange={setModel} />
                
                {/* Prompt Options - nested collapsible */}
                <div className="rounded-xl border border-border/30 overflow-hidden">
                  <button
                    onClick={() => setOptionsOpen(!optionsOpen)}
                    className="w-full flex items-center justify-between text-sm font-bold text-foreground px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors"
                  >
                    <span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> خيارات البرومت</span>
                    {optionsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <AnimatePresence>
                    {optionsOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden px-4 pb-3"
                      >
                        <PromptOptions options={options} onToggle={handleToggle} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* Collapsible Options */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8 rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden"
        >
          <button
            onClick={() => setOptionsOpen(!optionsOpen)}
            className="w-full flex items-center justify-between text-lg font-bold text-primary-foreground px-5 py-3.5 bg-gradient-to-l from-primary/80 via-secondary/70 to-accent/60 hover:from-primary hover:via-secondary hover:to-accent transition-all duration-200"
          >
            <span className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5" /> خيارات البرومت</span>
            {optionsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          <AnimatePresence>
            {optionsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden px-4 pb-4"
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

        {/* Prompt Section - Always visible */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden"
        >
          <button
            onClick={() => setPromptOpen(!promptOpen)}
            className="w-full flex items-center justify-between text-lg font-bold text-primary-foreground px-5 py-3.5 bg-gradient-to-l from-primary/80 via-secondary/70 to-accent/60 hover:from-primary hover:via-secondary hover:to-accent transition-all duration-200"
          >
            <span className="flex items-center gap-2"><FileText className="h-5 w-5" /> البرومت</span>
            {promptOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          <AnimatePresence>
            {promptOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden p-4"
              >
                {prompt ? (
                  <PromptResult prompt={prompt} onPromptChange={setPrompt} onActiveLangChange={setPromptLang} model={model} getActiveApiKey={getActiveApiKey} />
                ) : (
                  <div className="space-y-4">
                    <p className="text-muted-foreground text-sm text-center mb-3">
                      يمكنك كتابة البرومت يدوياً أو رفع صورة مرجعية لإنشائه تلقائياً
                    </p>
                    <Textarea
                      value={manualPrompt}
                      onChange={(e) => setManualPrompt(e.target.value)}
                      placeholder="اكتب البرومت هنا... مثال: مبنى حديث بتصميم مستقبلي مع إضاءة نيون زرقاء وسماء مليئة بالنجوم..."
                      className="rounded-xl bg-background/50 border-border/30 text-sm min-h-[120px]"
                      dir="rtl"
                    />
                    <Button
                      onClick={handleApplyManualPrompt}
                      disabled={!manualPrompt.trim()}
                      className="w-full rounded-xl h-10 text-sm font-bold bg-gradient-to-l from-primary via-secondary to-accent hover:opacity-90 text-primary-foreground"
                    >
                      <Wand2 className="h-4 w-4 ml-2" />
                      استخدام هذا البرومت
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* Generation Results - Collapsible */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden"
        >
          <button
            onClick={() => setResultsOpen(!resultsOpen)}
            className="w-full flex items-center justify-between text-lg font-bold text-primary-foreground px-5 py-3.5 bg-gradient-to-l from-primary/80 via-secondary/70 to-accent/60 hover:from-primary hover:via-secondary hover:to-accent transition-all duration-200"
          >
            <span className="flex items-center gap-2"><Images className="h-5 w-5" /> نتائج التوليد والتعديل</span>
            {resultsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          <AnimatePresence>
            {resultsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden p-4"
              >
                {/* Upload multiple images */}
                <div className="mb-4">
                  <h3 className="font-bold text-foreground text-sm flex items-center gap-2 mb-3">
                    <Images className="h-4 w-4" />
                    <span>ارفع الصور لتطبيق البرومت عليها</span>
                  </h3>
                  <MultiImageUploader images={originalImages} onImagesChange={setOriginalImages} />
                  {originalImages.length > 0 && (
                    <Button
                      onClick={handleGenerateEditedImage}
                      disabled={!prompt || generatingImage}
                      className="w-full mt-3 rounded-xl h-10 text-sm font-bold bg-gradient-to-l from-primary via-secondary to-accent hover:opacity-90 text-primary-foreground"
                    >
                      {generatingImage ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin ml-2" />
                          {generatingProgress.total > 1
                            ? `جارِ المعالجة ${generatingProgress.current}/${generatingProgress.total}...`
                            : "جارِ المعالجة..."}
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4 ml-2" />
                          تطبيق البرومت على {originalImages.length > 1 ? `${originalImages.length} صور` : "الصورة"}
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Results grid */}
                {Object.keys(generatedImages).length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      <span>النتائج المولّدة ({Object.keys(generatedImages).length})</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {Object.entries(generatedImages).map(([idx, img]) => (
                        <div key={idx} className="glass-card rounded-xl p-3 gradient-border space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-muted-foreground">صورة {Number(idx) + 1}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {originalImages[Number(idx)] && (
                              <img
                                src={originalImages[Number(idx)]}
                                alt={`أصلية ${Number(idx) + 1}`}
                                className="w-full aspect-square object-cover rounded-lg opacity-60 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => openViewer(originalImages[Number(idx)])}
                              />
                            )}
                            <img
                              src={img}
                              alt={`نتيجة ${Number(idx) + 1}`}
                              className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => openViewer(img)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Re-edit section */}
                {Object.keys(generatedImages).length > 0 && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-3">
                      <ImageContainer
                        label="النتيجة بعد التعديل"
                        emoji="✏️"
                        image={reEditedImage}
                        loading={reEditingImage}
                        actionLabel="تعديل أول صورة مولّدة"
                        actionIcon="edit"
                        onAction={handleReEditImage}
                        disabled={Object.keys(generatedImages).length === 0 || !editInstruction}
                        onImageClick={() => reEditedImage && openViewer(reEditedImage)}
                        onImageReplace={setReEditedImage}
                        containerId="reedited"
                        onDragStart={handleDragStart}
                        onDrop={handleDrop}
                      />
                      <Textarea
                        value={editInstruction}
                        onChange={(e) => setEditInstruction(e.target.value)}
                        placeholder="أدخل تعليمات التعديل... مثال: اجعل الألوان أكثر دفئاً، أضف غروب الشمس..."
                        className="rounded-xl bg-background/50 border-border/30 text-sm min-h-[80px]"
                        dir="rtl"
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* Upscale Section - Collapsible */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden"
        >
          <button
            onClick={() => setUpscaleOpen(!upscaleOpen)}
            className="w-full flex items-center justify-between text-lg font-bold text-primary-foreground px-5 py-3.5 bg-gradient-to-l from-primary/80 via-secondary/70 to-accent/60 hover:from-primary hover:via-secondary hover:to-accent transition-all duration-200"
          >
            <span className="flex items-center gap-2"><Search className="h-5 w-5" /> تكبير الصورة (Upscale)</span>
            {upscaleOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          <AnimatePresence>
            {upscaleOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden p-4"
              >
                <UpscaleSection
                  imageModel={imageModel}
                  getActiveApiKey={getActiveApiKey}
                  onImageClick={openViewer}
                  embedded
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

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
