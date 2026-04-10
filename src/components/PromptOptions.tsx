import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";

export interface PromptOption {
  id: string;
  labelAr: string;
  labelEn: string;
  emoji: string;
  enabled: boolean;
}

export const defaultOptions: PromptOption[] = [
  { id: "camera_angle", labelAr: "زاوية الكاميرا", labelEn: "Camera Angle", emoji: "📷", enabled: true },
  { id: "camera_effects", labelAr: "تأثيرات الكاميرا", labelEn: "Camera Effects", emoji: "🎬", enabled: true },
  { id: "environment", labelAr: "البيئة المحيطة", labelEn: "Environment", emoji: "🌍", enabled: true },
  { id: "colors", labelAr: "الألوان", labelEn: "Colors", emoji: "🎨", enabled: true },
  { id: "materials", labelAr: "الخامات والمواد", labelEn: "Materials & Textures", emoji: "🧱", enabled: true },
  { id: "lighting", labelAr: "الإضاءة", labelEn: "Lighting", emoji: "💡", enabled: true },
  { id: "time", labelAr: "التوقيت", labelEn: "Time of Day", emoji: "⏰", enabled: true },
  { id: "art_style", labelAr: "أسلوب الصورة", labelEn: "Art Style", emoji: "🖼️", enabled: true },
  { id: "mood", labelAr: "التعبيرات والمشاعر", labelEn: "Mood & Emotion", emoji: "😊", enabled: true },
  { id: "composition", labelAr: "التكوين", labelEn: "Composition", emoji: "📐", enabled: true },
];

interface PromptOptionsProps {
  options: PromptOption[];
  onToggle: (id: string) => void;
}

const PromptOptions = ({ options, onToggle }: PromptOptionsProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
      {options.map((opt, i) => (
        <motion.div
          key={opt.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          onClick={() => onToggle(opt.id)}
          className={`flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer transition-all duration-200 select-none
            ${opt.enabled
              ? "glass-card gradient-border ring-1 ring-primary/30"
              : "bg-muted/30 opacity-50 hover:opacity-70"
            }`}
        >
          <Label
            htmlFor={opt.id}
            className="flex items-center gap-2 cursor-pointer text-sm font-medium"
          >
            <span className="text-lg">{opt.emoji}</span>
            <span className="text-foreground">{opt.labelAr}</span>
          </Label>
          <div className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-all duration-200 ${opt.enabled ? 'bg-primary justify-end' : 'bg-muted-foreground/30 justify-start'}`}>
            <motion.div
              layout
              className={`w-5 h-5 rounded-full shadow-md ${opt.enabled ? 'bg-primary-foreground' : 'bg-muted-foreground/60'}`}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default PromptOptions;
