import { useState } from "react";
import { Settings, Eye, EyeOff, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { AppSettings } from "@/hooks/useSettings";

interface SettingsDialogProps {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
}

const providers = [
  { value: "lovable", label: "Lovable AI (افتراضي)", description: "يستخدم رصيد المنصة" },
  { value: "google", label: "Google Gemini", description: "استخدم مفتاح API الخاص بك" },
  { value: "openai", label: "OpenAI", description: "استخدم مفتاح API الخاص بك" },
  { value: "custom", label: "مخصص", description: "أدخل رابط ومفتاح API يدوياً" },
];

const SettingsDialog = ({ settings, onUpdate }: SettingsDialogProps) => {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const toggleKeyVisibility = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    toast.success("تم حفظ الإعدادات بنجاح ✅");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-10 w-10 bg-card/60 backdrop-blur border border-border/30 hover:bg-card/80"
        >
          <Settings className="h-5 w-5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-card border-border/50" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            الإعدادات
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Email */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">البريد الإلكتروني</Label>
            <Input
              type="email"
              placeholder="example@email.com"
              value={settings.email}
              onChange={(e) => onUpdate({ email: e.target.value })}
              className="rounded-xl bg-background/50 border-border/30"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">لربط حسابك وحفظ إعداداتك</p>
          </div>

          {/* API Provider */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">مزود الذكاء الاصطناعي</Label>
            <Select
              value={settings.apiProvider}
              onValueChange={(v) => onUpdate({ apiProvider: v as AppSettings["apiProvider"] })}
            >
              <SelectTrigger className="rounded-xl bg-background/50 border-border/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex flex-col">
                      <span>{p.label}</span>
                      <span className="text-xs text-muted-foreground">{p.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Google API Key */}
          {settings.apiProvider === "google" && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">مفتاح Google Gemini API</Label>
              <div className="relative">
                <Input
                  type={showKeys.google ? "text" : "password"}
                  placeholder="AIza..."
                  value={settings.googleApiKey}
                  onChange={(e) => onUpdate({ googleApiKey: e.target.value })}
                  className="rounded-xl bg-background/50 border-border/30 pl-10"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => toggleKeyVisibility("google")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKeys.google ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                احصل على مفتاح API مجاني من Google AI Studio
              </a>
            </div>
          )}

          {/* OpenAI API Key */}
          {settings.apiProvider === "openai" && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">مفتاح OpenAI API</Label>
              <div className="relative">
                <Input
                  type={showKeys.openai ? "text" : "password"}
                  placeholder="sk-..."
                  value={settings.openaiApiKey}
                  onChange={(e) => onUpdate({ openaiApiKey: e.target.value })}
                  className="rounded-xl bg-background/50 border-border/30 pl-10"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => toggleKeyVisibility("openai")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKeys.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                احصل على مفتاح API من OpenAI
              </a>
            </div>
          )}

          {/* Custom API */}
          {settings.apiProvider === "custom" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">رابط API</Label>
                <Input
                  type="url"
                  placeholder="https://api.example.com/v1/chat/completions"
                  value={settings.customApiUrl}
                  onChange={(e) => onUpdate({ customApiUrl: e.target.value })}
                  className="rounded-xl bg-background/50 border-border/30"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">مفتاح API</Label>
                <div className="relative">
                  <Input
                    type={showKeys.custom ? "text" : "password"}
                    placeholder="your-api-key"
                    value={settings.customApiKey}
                    onChange={(e) => onUpdate({ customApiKey: e.target.value })}
                    className="rounded-xl bg-background/50 border-border/30 pl-10"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => toggleKeyVisibility("custom")}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKeys.custom ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Info box */}
          {settings.apiProvider !== "lovable" && (
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                💡 مفتاح API الخاص بك يُحفظ محلياً في المتصفح فقط ويُرسل بشكل آمن عبر الخادم. لا يتم تخزينه على أي خادم خارجي.
              </p>
            </div>
          )}

          <Button
            onClick={handleSave}
            className="w-full rounded-xl bg-gradient-to-l from-primary via-secondary to-accent hover:opacity-90 text-primary-foreground font-bold"
          >
            حفظ الإعدادات
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
