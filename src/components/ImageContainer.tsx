import { useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, Wand2, RefreshCw, Download, Upload, Replace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePasteImage } from "@/hooks/usePasteImage";

interface ImageContainerProps {
  label: string;
  emoji: string;
  image: string | null;
  loading?: boolean;
  actionLabel?: string;
  actionIcon?: "generate" | "edit";
  onAction?: () => void;
  disabled?: boolean;
  onImageClick?: () => void;
  onImageReplace?: (newImage: string) => void;
  containerId?: string;
  onDragStart?: (containerId: string) => void;
  onDrop?: (containerId: string) => void;
  hideEmptyState?: boolean;
}

const ImageContainer = ({
  label,
  emoji,
  image,
  loading,
  actionLabel,
  actionIcon,
  onAction,
  disabled,
  onImageClick,
  onImageReplace,
  containerId,
  onDragStart,
  onDrop,
  hideEmptyState,
}: ImageContainerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteRef = usePasteImage((dataUrl) => {
    if (onImageReplace) onImageReplace(dataUrl);
  });

  const handleDownload = () => {
    if (!image) return;
    const link = document.createElement("a");
    link.href = image;
    link.download = `${label}.png`;
    link.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/") || !onImageReplace) return;
    const reader = new FileReader();
    reader.onload = (ev) => onImageReplace(ev.target?.result as string);
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

    // Check if it's a file drop
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/") && onImageReplace) {
      const reader = new FileReader();
      reader.onload = (ev) => onImageReplace(ev.target?.result as string);
      reader.readAsDataURL(file);
      return;
    }

    // Check if it's an inter-container drag
    if (containerId && onDrop) {
      onDrop(containerId);
    }
  };

  const handleDragStartEvent = (e: React.DragEvent) => {
    if (!image || !containerId || !onDragStart) return;
    e.dataTransfer.setData("text/plain", containerId);
    onDragStart(containerId);
  };

  if (hideEmptyState && !image && !loading) {
    // Only show the action button
    return onAction && actionLabel ? (
      <Button
        onClick={onAction}
        disabled={disabled || loading}
        className="w-full rounded-xl h-10 text-sm font-bold bg-gradient-to-l from-primary via-secondary to-accent hover:opacity-90 text-primary-foreground"
      >
        {actionIcon === "edit" ? (
          <RefreshCw className="h-4 w-4 ml-2" />
        ) : (
          <Wand2 className="h-4 w-4 ml-2" />
        )}
        {actionLabel}
      </Button>
    ) : null;
  }

  return (
    <motion.div
      ref={pasteRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-4 gradient-border transition-all"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropEvent}
      tabIndex={0}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
          <span>{emoji}</span>
          <span>{label}</span>
        </h3>
        <div className="flex items-center gap-1">
          {image && onImageReplace && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fileInputRef.current?.click()}>
              <Replace className="h-3.5 w-3.5" />
            </Button>
          )}
          {image && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div
        className="relative rounded-xl overflow-hidden bg-muted/20 min-h-[200px] flex items-center justify-center"
        draggable={!!image}
        onDragStart={handleDragStartEvent}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">جارِ الإنشاء...</p>
          </div>
        ) : image ? (
          <img
            src={image}
            alt={label}
            className="w-full max-h-[350px] object-contain rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
            onClick={onImageClick}
          />
        ) : (
          <div
            className="flex flex-col items-center gap-3 py-8 text-muted-foreground cursor-pointer w-full"
            onClick={() => onImageReplace && fileInputRef.current?.click()}
          >
            <span className="text-3xl opacity-30">{emoji}</span>
            <p className="text-xs">اسحب صورة هنا أو اضغط للاختيار</p>
            <Upload className="h-4 w-4 opacity-30" />
          </div>
        )}
      </div>

      {onAction && actionLabel && (
        <Button
          onClick={onAction}
          disabled={disabled || loading}
          className="w-full mt-3 rounded-xl h-10 text-sm font-bold bg-gradient-to-l from-primary via-secondary to-accent hover:opacity-90 text-primary-foreground"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin ml-2" />
          ) : actionIcon === "edit" ? (
            <RefreshCw className="h-4 w-4 ml-2" />
          ) : (
            <Wand2 className="h-4 w-4 ml-2" />
          )}
          {actionLabel}
        </Button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />
    </motion.div>
  );
};

export default ImageContainer;
