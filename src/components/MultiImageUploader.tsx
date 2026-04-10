import { useCallback, useRef, useState } from "react";
import { Upload, X, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface MultiImageUploaderProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
}

const MultiImageUploader = ({ images, onImagesChange }: MultiImageUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const newImages: Promise<string>[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        newImages.push(
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          })
        );
      }
      Promise.all(newImages).then((results) => {
        if (results.length > 0) {
          onImagesChange([...images, ...results]);
        }
      });
    },
    [images, onImagesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full space-y-3">
      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative group rounded-xl overflow-hidden gradient-border aspect-square"
            >
              <img
                src={img}
                alt={`صورة ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-6 w-6 rounded-full shadow-lg"
                  onClick={() => removeImage(idx)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="absolute bottom-1 left-1 bg-background/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-bold text-foreground">
                {idx + 1}
              </div>
            </motion.div>
          ))}

          {/* Add more button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => inputRef.current?.click()}
            className="flex items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer aspect-square transition-all"
          >
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Plus className="h-6 w-6" />
              <span className="text-xs">إضافة</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Upload area (shown when no images) */}
      {images.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 transition-all duration-300 text-center
            ${isDragging
              ? "border-primary bg-primary/10 scale-[1.02]"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
            }`}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-primary/10 p-3">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                اسحب الصور هنا أو اضغط للاختيار
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                يمكنك اختيار عدة صور دفعة واحدة
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {images.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{images.length} صورة مختارة</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={() => onImagesChange([])}
          >
            حذف الكل
          </Button>
        </div>
      )}
    </div>
  );
};

export default MultiImageUploader;
