import { Brush } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface ImageModel {
  id: string;
  label: string;
  description: string;
}

export const imageModels: ImageModel[] = [
  { id: "google/gemini-2.5-flash-image", label: "Nano Banana 2", description: "سريع ومتوازن لإنشاء الصور" },
  { id: "google/gemini-3-pro-image-preview", label: "Nano Banana Pro", description: "جودة أعلى وأبطأ" },
];

interface ImageModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const ImageModelSelector = ({ value, onChange }: ImageModelSelectorProps) => {
  const selected = imageModels.find((m) => m.id === value);

  return (
    <div className="flex items-center gap-3">
      <Brush className="h-5 w-5 text-primary" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1 glass-card border-border/30 rounded-xl h-11">
          <SelectValue>
            {selected ? `${selected.label} — ${selected.description}` : "اختر نموذج الصور"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {imageModels.map((model) => (
            <SelectItem key={model.id} value={model.id} className="rounded-lg">
              <div className="flex flex-col">
                <span className="font-medium">{model.label}</span>
                <span className="text-xs text-muted-foreground">{model.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ImageModelSelector;
