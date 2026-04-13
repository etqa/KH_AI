import { useState } from "react";
import { Settings, Eye, EyeOff, ExternalLink, Plus, Trash2, UserCircle } from "lucide-react";
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
import type { Account, AppSettings } from "@/hooks/useSettings";

interface SettingsDialogProps {
  settings: AppSettings;
  activeAccount: Account;
  onUpdateAccount: (partial: Partial<Account>) => void;
  onSetActive: (id: string) => void;
  onAddAccount: () => void;
  onRemoveAccount: (id: string) => void;
}

const providers = [
  { value: "lovable", label: "Lovable AI (افتراضي)", description: "يستخدم رصيد المنصة" },
  { value: "google", label: "Google Gemini", description: "استخدم مفتاح API الخاص بك" },
  { value: "openai", label: "OpenAI", description: "استخدم مفتاح API الخاص بك" },
  { value: "custom", label: "مخصص", description: "أدخل رابط ومفتاح API يدوياً" },
];

const SettingsDialog = ({ settings, activeAccount, onUpdateAccount, onSetActive, onAddAccount, onRemoveAccount }: SettingsDialogProps) => {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const toggleKeyVisibility = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    toast.success("تم حفظ الإعدادات بنجاح ✅");
  };

  const account = activeAccount;

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

        <div className="space-y-6 mt-4 max-h-[70vh] overflow-y-auto px-1">
          {/* Account Switcher */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <UserCircle className="h-4 w-4" />
              الحسابات
            </Label>
            <div className="flex gap-2">
              <Select value={account.id} onValueChange={onSetActive}>
                <SelectTrigger className="rounded-xl bg-background/50 border-border/30 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {settings.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span>{a.name || a.email || "حساب بدون اسم"}</span>
                      {a.apiProvider !== "lovable" && (
                        <span className="text-xs text-muted-foreground mr-2">({a.apiProvider})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl border-border/30 shrink-0"
                onClick={() => {
                  onAddAccount();
                  toast.success("تم إضافة حساب جديد ✅");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
              {settings.accounts.length > 1 && (
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => {
                    onRemoveAccount(account.id);
                    toast.success("تم حذف الحساب");
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Account Name */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">اسم الحساب</Label>
            <Input
              type="text"
              placeholder="مثال: حسابي الشخصي"
              value={account.name}
              onChange={(e) => onUpdateAccount({ name: e.target.value })}
              className="rounded-xl bg-background/50 border-border/30"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">البريد الإلكتروني</Label>
            <Input
              type="email"
              placeholder="example@email.com"
              value={account.email}
              onChange={(e) => onUpdateAccount({ email: e.target.value })}
              className="rounded-xl bg-background/50 border-border/30"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">لربط حسابك وحفظ إعداداتك</p>
          </div>

          {/* API Provider */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">مزود الذكاء الاصطناعي</Label>
            <Select
              value={account.apiProvider}
              onValueChange={(v) => onUpdateAccount({ apiProvider: v as Account["apiProvider"] })}
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
          {account.apiProvider === "google" && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">مفتاح Google Gemini API</Label>
              <div className="relative">
                <Input
                  type={showKeys.google ? "text" : "password"}
                  placeholder="AIza..."
                  value={account.googleApiKey}
                  onChange={(e) => onUpdateAccount({ googleApiKey: e.target.value })}
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
          {account.apiProvider === "openai" && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">مفتاح OpenAI API</Label>
              <div className="relative">
                <Input
                  type={showKeys.openai ? "text" : "password"}
                  placeholder="sk-..."
                  value={account.openaiApiKey}
                  onChange={(e) => onUpdateAccount({ openaiApiKey: e.target.value })}
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
          {account.apiProvider === "custom" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">رابط API</Label>
                <Input
                  type="url"
                  placeholder="https://api.example.com/v1/chat/completions"
                  value={account.customApiUrl}
                  onChange={(e) => onUpdateAccount({ customApiUrl: e.target.value })}
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
                    value={account.customApiKey}
                    onChange={(e) => onUpdateAccount({ customApiKey: e.target.value })}
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
          {account.apiProvider !== "lovable" && (
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
