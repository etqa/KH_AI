import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Enables pasting an image (Ctrl+V / Cmd+V) into a container element.
 * Paste fires only when the container is hovered or has focus-within,
 * so multiple paste-aware containers on the same page do not conflict.
 */
export function usePasteImage(onImage: (dataUrl: string) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const hoveredRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onEnter = () => { hoveredRef.current = true; };
    const onLeave = () => { hoveredRef.current = false; };
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);

    const onPaste = (e: ClipboardEvent) => {
      const isFocused =
        hoveredRef.current ||
        (document.activeElement && el.contains(document.activeElement));
      if (!isFocused) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = (ev) => {
            onImage(ev.target?.result as string);
            toast.success("تم لصق الصورة ✅");
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    };

    window.addEventListener("paste", onPaste);
    return () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("paste", onPaste);
    };
  }, [onImage]);

  return ref;
}
