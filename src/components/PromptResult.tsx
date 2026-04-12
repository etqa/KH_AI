import { useState, useEffect, useCallback } from "react";
import { Copy, Check, Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PromptSection {
  ar: string;
  en: string;
}

export interface StructuredPrompt {
  titleAr: string;
  titleEn: string;
  overviewAr: string;
  overviewEn: string;
  sections: Record<string, PromptSection>;
}

const sectionEmojis: Record<string, string> = {
  "Camera Angle": "📷",
  "Camera Effects": "🎬",
  "Environment": "🌍",
  "Colors": "🎨",
  "Materials & Textures": "🧱",
  "Lighting": "💡",
  "Time of Day": "⏰",
  "Art Style": "🖼️",
  "Mood & Emotion": "😊",
  "Composition": "📐",
};

const sectionLabelsAr: Record<string, string> = {
  "Camera Angle": "زاوية الكاميرا",
  "Camera Effects": "تأثيرات الكاميرا",
  "Environment": "البيئة المحيطة",
  "Colors": "الألوان",
  "Materials & Textures": "الخامات والمواد",
  "Lighting": "الإضاءة",
  "Time of Day": "التوقيت",
  "Art Style": "أسلوب الصورة",
  "Mood & Emotion": "التعبيرات والمشاعر",
  "Composition": "التكوين",
};

interface PromptResultProps {
  prompt: StructuredPrompt;
  onPromptChange?: (updated: StructuredPrompt) => void;
  onActiveLangChange?: (lang: "ar" | "en") => void;
  model?: string;
  getActiveApiKey?: () => any;
}

const PromptResult = ({ prompt, onPromptChange, onActiveLangChange, model, getActiveApiKey }: PromptResultProps) => {
  const [copiedLang, setCopiedLang] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<"ar" | "en">("ar");
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    onActiveLangChange?.(activeLang);
  }, [activeLang, onActiveLangChange]);

  const buildFullText = (lang: "ar" | "en") => {
    const title = lang === "ar" ? prompt.titleAr : prompt.titleEn;
    const overview = lang === "ar" ? prompt.overviewAr : prompt.overviewEn;
    let text = `${title}\n${overview}\n\n`;
    for (const [key, section] of Object.entries(prompt.sections)) {
      const label = lang === "ar" ? (sectionLabelsAr[key] || key) : key;
      text += `${label}\n${section[lang]}\n\n`;
    }
    return text.trim();
  };

  const handleCopy = async (lang: "ar" | "en") => {
    await navigator.clipboard.writeText(buildFullText(lang));
    setCopiedLang(lang);
    toast.success(lang === "ar" ? "تم النسخ!" : "Copied!");
    setTimeout(() => setCopiedLang(null), 2000);
  };

  const handleTranslate = async () => {
    if (!onPromptChange) return;
    const sourceLang = activeLang === "ar" ? "ar" : "en";
    const targetLang = activeLang === "ar" ? "en" : "ar";
    const sourceText = buildFullText(sourceLang);

    setTranslating(true);
    try {
      const customApi = getActiveApiKey?.();
      const { data, error } = await supabase.functions.invoke("analyze-image", {
        body: {
          translateMode: true,
          sourceText,
          sourceLang,
          targetLang,
          prompt,
          model: model || "google/gemini-3-flash-preview",
          customApi,
        },
      });
      if (error) throw error;
      if (data) {
        onPromptChange(data as StructuredPrompt);
        toast.success(targetLang === "ar" ? "تمت الترجمة للعربية! 🌐" : "Translated to English! 🌐");
      }
    } catch (err: any) {
      console.error("Translation error:", err);
      toast.error("حدث خطأ أثناء الترجمة");
    } finally {
      setTranslating(false);
    }
  };

  const updateField = useCallback((field: string, value: string) => {
    if (!onPromptChange) return;
    const updated = { ...prompt };
    if (field === "titleAr") updated.titleAr = value;
    else if (field === "titleEn") updated.titleEn = value;
    else if (field === "overviewAr") updated.overviewAr = value;
    else if (field === "overviewEn") updated.overviewEn = value;
    onPromptChange(updated);
  }, [prompt, onPromptChange]);

  const updateSection = useCallback((key: string, lang: "ar" | "en", value: string) => {
    if (!onPromptChange) return;
    const updated = {
      ...prompt,
      sections: {
        ...prompt.sections,
        [key]: { ...prompt.sections[key], [lang]: value },
      },
    };
    onPromptChange(updated);
  }, [prompt, onPromptChange]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <Tabs defaultValue="ar" className="w-full" dir="rtl" onValueChange={(v) => setActiveLang(v as "ar" | "en")}>
        <div className="flex items-center gap-2">
          <TabsList className="flex-1 bg-muted/30 rounded-xl">
            <TabsTrigger value="ar" className="flex-1 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              🇸🇦 عربي
            </TabsTrigger>
            <TabsTrigger value="en" className="flex-1 rounded-lg data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
              🇬🇧 English
            </TabsTrigger>
          </TabsList>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTranslate}
            disabled={translating}
            className="rounded-lg h-9 px-3 text-xs font-bold border-primary/30 hover:bg-primary/10 gap-1.5 shrink-0"
          >
            {translating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Languages className="h-3.5 w-3.5" />
            )}
            {translating ? "جارِ الترجمة..." : activeLang === "ar" ? "ترجم للإنجليزية" : "Translate to Arabic"}
          </Button>
        </div>

        {(["ar", "en"] as const).map((lang) => (
          <TabsContent key={lang} value={lang} className="mt-4">
            <div className="glass-card rounded-xl p-5 gradient-border space-y-4">
              {/* Header with copy */}
              <div className="flex items-center justify-between gap-2">
                <input
                  value={lang === "ar" ? prompt.titleAr : prompt.titleEn}
                  onChange={(e) => updateField(lang === "ar" ? "titleAr" : "titleEn", e.target.value)}
                  className="font-bold text-foreground text-lg bg-transparent border-none outline-none flex-1 focus:ring-1 focus:ring-primary/30 rounded px-1"
                  dir={lang === "ar" ? "rtl" : "ltr"}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopy(lang)}
                  className="h-8 w-8 shrink-0"
                >
                  {copiedLang === lang ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              {/* Overview */}
              <Textarea
                value={lang === "ar" ? prompt.overviewAr : prompt.overviewEn}
                onChange={(e) => updateField(lang === "ar" ? "overviewAr" : "overviewEn", e.target.value)}
                className="text-muted-foreground leading-relaxed text-sm bg-transparent border-border/20 focus:border-primary/30 min-h-[60px] resize-none"
                dir={lang === "ar" ? "rtl" : "ltr"}
              />

              {/* Sections */}
              {Object.entries(prompt.sections).map(([key, section]) => (
                <div key={key} className="border-t border-border/30 pt-3">
                  <h4 className="font-semibold text-foreground text-sm flex items-center gap-2 mb-2" dir={lang === "ar" ? "rtl" : "ltr"}>
                    <span>{sectionEmojis[key] || "📌"}</span>
                    <span>{lang === "ar" ? (sectionLabelsAr[key] || key) : key}</span>
                  </h4>
                  <Textarea
                    value={section[lang]}
                    onChange={(e) => updateSection(key, lang, e.target.value)}
                    className="text-muted-foreground leading-relaxed text-sm bg-transparent border-border/20 focus:border-primary/30 min-h-[50px] resize-none whitespace-pre-wrap"
                    dir={lang === "ar" ? "rtl" : "ltr"}
                  />
                </div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </motion.div>
  );
};

export default PromptResult;
