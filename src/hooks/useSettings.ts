import { useState, useEffect, useCallback } from "react";
import { z } from "zod";

const AppSettingsSchema = z.object({
  email: z.string().max(255).default(""),
  apiProvider: z.enum(["lovable", "google", "openai", "custom"]).default("lovable"),
  googleApiKey: z.string().max(500).default(""),
  openaiApiKey: z.string().max(500).default(""),
  customApiKey: z.string().max(500).default(""),
  customApiUrl: z.string().max(500).default(""),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

const STORAGE_KEY = "app-settings";

const defaultSettings: AppSettings = {
  email: "",
  apiProvider: "lovable",
  googleApiKey: "",
  openaiApiKey: "",
  customApiKey: "",
  customApiUrl: "",
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return defaultSettings;
      const parsed = JSON.parse(stored);
      const validated = AppSettingsSchema.safeParse(parsed);
      return validated.success ? validated.data : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...partial };
      const validated = AppSettingsSchema.safeParse(merged);
      return validated.success ? validated.data : prev;
    });
  }, []);

  const getActiveApiKey = useCallback((): { provider: string; apiKey: string; apiUrl?: string } | null => {
    switch (settings.apiProvider) {
      case "google":
        return settings.googleApiKey ? { provider: "google", apiKey: settings.googleApiKey } : null;
      case "openai":
        return settings.openaiApiKey ? { provider: "openai", apiKey: settings.openaiApiKey } : null;
      case "custom":
        return settings.customApiKey ? { provider: "custom", apiKey: settings.customApiKey, apiUrl: settings.customApiUrl } : null;
      default:
        return null;
    }
  }, [settings]);

  return { settings, updateSettings, getActiveApiKey };
}
