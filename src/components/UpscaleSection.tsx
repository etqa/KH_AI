import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, ZoomIn, Upload, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";


interface UpscaleSectionProps {
  imageModel: string;
  getActiveApiKey: () => any;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  allContainerImages?: { id: string; label: string; src: string }[];
  onImageClick?: (src: string) => void;
}

const UpscaleSection = ({
  imageModel,
  getActiveApiKey,
  onImageClick,
}: UpscaleSectionProps) => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [upscaledImage, setUpscaledImage] = useState<string | null>(null);
  const [scale, setScale] = useState(2);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => setSourceImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("ring-2", "ring-primary/50");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("ring-2", "ring-primary/50");
  };

  const handleDropEvent = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("ring-2", "ring-primary/50");
    
    // File drop
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setSourceImage(ev.target?.result as string);
      reader.readAsDataURL(file);
      return;
    }

    // Check for image data from other containers
    const imageData = e.dataTransfer.getData("text/plain");
    if (imageData) {
      // This will be handled by the parent for inter-container drops
    }
  };

  const upscaleWithCanvas = (imgSrc: string, scaleFactor: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const newWidth = img.naturalWidth * scaleFactor;
        const newHeight = img.naturalHeight * scaleFactor;

        const canvas = document.createElement("canvas");
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }

        // High-quality upscale
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        // Sharpening pass using unsharp mask technique
        const sharpenCanvas = document.createElement("canvas");
        sharpenCanvas.width = newWidth;
        sharpenCanvas.height = newHeight;
        const sCtx = sharpenCanvas.getContext("2d");
        if (sCtx) {
          // Draw blurred version
          sCtx.filter = "blur(1px)";
          sCtx.drawImage(canvas, 0, 0);
          sCtx.filter = "none";

          // Apply unsharp mask
          const original = ctx.getImageData(0, 0, newWidth, newHeight);
          const blurred = sCtx.getImageData(0, 0, newWidth, newHeight);
          const amount = 0.5;
          for (let i = 0; i < original.data.length; i += 4) {
            original.data[i] = Math.min(255, Math.max(0, original.data[i] + amount * (original.data[i] - blurred.data[i])));
            original.data[i + 1] = Math.min(255, Math.max(0, original.data[i + 1] + amount * (original.data[i + 1] - blurred.data[i + 1])));
            original.data[i + 2] = Math.min(255, Math.max(0, original.data[i + 2] + amount * (original.data[i + 2] - blurred.data[i + 2])));
          }
          ctx.putImageData(original, 0, 0);
        }

        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("فشل تحميل الصورة"));
      img.src = imgSrc;
    });
  };

  const handleUpscale = async () => {
    if (!sourceImage) {
      toast.error("الرجاء رفع صورة أولاً");
      return;
    }
    setLoading(true);
    setUpscaledImage(null);
    try {
      const result = await upscaleWithCanvas(sourceImage, scale);
      setUpscaledImage(result);
      toast.success(`تم تكبير الصورة ${scale}X بنجاح! 🔍`);
    } catch (err: any) {
      console.error("Error upscaling:", err);
      toast.error(err.message || "حدث خطأ أثناء تكبير الصورة");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (img: string, name: string) => {
    const link = document.createElement("a");
    link.href = img;
    link.download = `${name}.png`;
    link.click();
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8"
    >
      <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        🔍 تكبير الصورة (Upscale)
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source image */}
        <div className="glass-card rounded-xl p-4 gradient-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <span>📷</span>
              <span>الصورة الأصلية</span>
            </h3>
            {sourceImage && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => { setSourceImage(null); setUpscaledImage(null); }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <div
            className="relative rounded-xl overflow-hidden bg-muted/20 min-h-[200px] flex items-center justify-center transition-all"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDropEvent}
          >
            {sourceImage ? (
              <img
                src={sourceImage}
                alt="Source"
                className="w-full max-h-[350px] object-contain rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => onImageClick?.(sourceImage)}
              />
            ) : (
              <div
                className="flex flex-col items-center gap-3 py-8 text-muted-foreground cursor-pointer w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 opacity-30" />
                <p className="text-xs">اسحب صورة هنا أو اضغط للاختيار</p>
                <p className="text-[10px] opacity-50">يمكنك سحب صورة من الحاويات أعلاه</p>
              </div>
            )}
          </div>

          {/* Scale slider */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">مستوى التكبير</span>
              <span className="font-bold text-primary">{scale}X</span>
            </div>
            <Slider
              value={[scale]}
              onValueChange={(v) => setScale(v[0])}
              min={2}
              max={6}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>2X</span>
              <span>3X</span>
              <span>4X</span>
              <span>5X</span>
              <span>6X</span>
            </div>
          </div>

          <Button
            onClick={handleUpscale}
            disabled={!sourceImage || loading}
            className="w-full mt-3 rounded-xl h-10 text-sm font-bold bg-gradient-to-l from-primary via-secondary to-accent hover:opacity-90 text-primary-foreground"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : (
              <ZoomIn className="h-4 w-4 ml-2" />
            )}
            تكبير الصورة {scale}X
          </Button>
        </div>

        {/* Upscaled result */}
        <div className="glass-card rounded-xl p-4 gradient-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <span>✨</span>
              <span>النتيجة المكبّرة</span>
            </h3>
            {upscaledImage && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleDownload(upscaledImage, `upscaled-${scale}x`)}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <div className="relative rounded-xl overflow-hidden bg-muted/20 min-h-[200px] flex items-center justify-center">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">جارِ التكبير {scale}X...</p>
              </div>
            ) : upscaledImage ? (
              <img
                src={upscaledImage}
                alt="Upscaled"
                className="w-full max-h-[350px] object-contain rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => onImageClick?.(upscaledImage)}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                <span className="text-3xl opacity-30">🔍</span>
                <p className="text-xs">ستظهر النتيجة هنا</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />
    </motion.section>
  );
};

export default UpscaleSection;
