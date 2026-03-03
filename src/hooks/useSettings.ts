import { useState, useEffect, useCallback } from "react";

export interface AppSettings {
  email: string;
  apiProvider: "lovable" | "google" | "openai" | "custom";
  googleApiKey: string;
  openaiApiKey: string;
  customApiKey: string;
  customApiUrl: string;
}

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
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
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
        return null; // Use Lovable default
    }
  }, [settings]);

  return { settings, updateSettings, getActiveApiKey };
}
