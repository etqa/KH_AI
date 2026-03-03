import { useState, useRef, useCallback, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw, Columns } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface ImageViewerProps {
  images: { src: string; label: string }[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

const ImageViewer = ({ images, initialIndex = 0, open, onClose }: ImageViewerProps) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [compareIndex, setCompareIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setSelectedIndex(initialIndex);
      setCompareIndex(null);
      setCompareMode(false);
    }
  }, [open, initialIndex]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.min(5, Math.max(0.5, prev + (e.deltaY > 0 ? -0.2 : 0.2))));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom > 1) {
      setDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [zoom, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const resetView = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const availableImages = images.filter((img) => img.src);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoom((p) => Math.min(5, p + 0.3));
      if (e.key === "-") setZoom((p) => Math.max(0.5, p - 0.3));
      if (e.key === "0") resetView();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open || availableImages.length === 0) return null;

  const currentImage = availableImages[selectedIndex] || availableImages[0];
  const compareImage = compareIndex !== null ? availableImages[compareIndex] : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col"
        dir="rtl"
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 border-b border-border/30">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setZoom((p) => Math.min(5, p + 0.3))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setZoom((p) => Math.max(0.5, p - 0.3))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={resetView}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground mx-2">{Math.round(zoom * 100)}%</span>
            {availableImages.length >= 2 && (
              <Button
                variant={compareMode ? "default" : "ghost"}
                size="sm"
                className="rounded-lg text-xs gap-1"
                onClick={() => {
                  setCompareMode(!compareMode);
                  if (!compareMode && compareIndex === null) {
                    setCompareIndex(selectedIndex === 0 ? 1 : 0);
                  }
                }}
              >
                <Columns className="h-3.5 w-3.5" />
                مقارنة
              </Button>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Image thumbnails */}
        {availableImages.length > 1 && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20 overflow-x-auto">
            {availableImages.map((img, i) => (
              <button
                key={i}
                onClick={() => {
                  if (compareMode) setCompareIndex(i);
                  else setSelectedIndex(i);
                }}
                className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                  (compareMode ? compareIndex === i : selectedIndex === i)
                    ? "border-primary shadow-lg shadow-primary/20"
                    : "border-border/30 opacity-60 hover:opacity-100"
                }`}
              >
                <img src={img.src} alt={img.label} className="h-12 w-12 object-cover" />
                <p className="text-[10px] text-center text-muted-foreground truncate px-1">{img.label}</p>
              </button>
            ))}
          </div>
        )}

        {/* Image display */}
        <div
          ref={containerRef}
          className={`flex-1 overflow-hidden flex ${compareMode ? "gap-1" : ""}`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
        >
          <div className={`flex items-center justify-center ${compareMode ? "w-1/2 border-l border-border/20" : "w-full"}`}>
            <img
              src={currentImage.src}
              alt={currentImage.label}
              className="max-w-full max-h-full object-contain select-none"
              style={{
                transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                transition: dragging ? "none" : "transform 0.15s ease",
              }}
              draggable={false}
            />
          </div>
          {compareMode && compareImage && (
            <div className="w-1/2 flex items-center justify-center">
              <img
                src={compareImage.src}
                alt={compareImage.label}
                className="max-w-full max-h-full object-contain select-none"
                style={{
                  transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                  transition: dragging ? "none" : "transform 0.15s ease",
                }}
                draggable={false}
              />
            </div>
          )}
        </div>

        {/* Labels */}
        <div className={`flex ${compareMode ? "justify-around" : "justify-center"} p-2 border-t border-border/20`}>
          <span className="text-xs text-muted-foreground">{currentImage.label}</span>
          {compareMode && compareImage && (
            <span className="text-xs text-muted-foreground">{compareImage.label}</span>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ImageViewer;
