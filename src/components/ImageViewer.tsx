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
  const [sliderPos, setSliderPos] = useState(50); // percent
  const [sliderDragging, setSliderDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const compareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setSelectedIndex(initialIndex);
      setCompareIndex(null);
      setCompareMode(false);
      setSliderPos(50);
    }
  }, [open, initialIndex]);

  // Slider drag handlers
  useEffect(() => {
    if (!sliderDragging) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const rect = compareRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const pct = ((clientX - rect.left) / rect.width) * 100;
      setSliderPos(Math.max(0, Math.min(100, pct)));
    };
    const stop = () => setSliderDragging(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchend", stop);
    };
  }, [sliderDragging]);

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
          className="flex-1 overflow-hidden flex"
          onWheel={handleWheel}
          onMouseDown={compareMode ? undefined : handleMouseDown}
          onMouseMove={compareMode ? undefined : handleMouseMove}
          onMouseUp={compareMode ? undefined : handleMouseUp}
          onMouseLeave={compareMode ? undefined : handleMouseUp}
          style={{ cursor: !compareMode && zoom > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
        >
          {!compareMode ? (
            <div className="flex items-center justify-center w-full">
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
          ) : (
            <div ref={compareRef} className="relative w-full h-full select-none overflow-hidden">
              {/* Base image (after / current) */}
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src={currentImage.src}
                  alt={currentImage.label}
                  className="max-w-full max-h-full object-contain"
                  draggable={false}
                />
              </div>
              {/* Top image clipped (before / compare) */}
              {compareImage && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                >
                  <img
                    src={compareImage.src}
                    alt={compareImage.label}
                    className="max-w-full max-h-full object-contain"
                    draggable={false}
                  />
                </div>
              )}
              {/* Divider */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-[0_0_12px_hsl(var(--primary))] cursor-ew-resize"
                style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
                onMouseDown={(e) => { e.preventDefault(); setSliderDragging(true); }}
                onTouchStart={(e) => { e.preventDefault(); setSliderDragging(true); }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                  <Columns className="h-5 w-5" />
                </div>
              </div>
              {/* Labels overlay */}
              {compareImage && (
                <>
                  <div className="absolute top-3 right-3 bg-background/70 backdrop-blur-sm px-3 py-1 rounded-md text-xs">
                    {compareImage.label}
                  </div>
                  <div className="absolute top-3 left-3 bg-background/70 backdrop-blur-sm px-3 py-1 rounded-md text-xs">
                    {currentImage.label}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Labels */}
        <div className="flex justify-center p-2 border-t border-border/20">
          <span className="text-xs text-muted-foreground">
            {compareMode && compareImage
              ? `مقارنة: ${compareImage.label} ↔ ${currentImage.label}`
              : currentImage.label}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ImageViewer;
