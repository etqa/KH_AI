import { useState, useEffect, useCallback } from "react";
import { z } from "zod";

const AccountSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string().max(100).default(""),
  email: z.string().max(255).default(""),
  apiProvider: z.enum(["lovable", "google", "openai", "custom"]).default("lovable"),
  googleApiKey: z.string().max(500).default(""),
  openaiApiKey: z.string().max(500).default(""),
  customApiKey: z.string().max(500).default(""),
  customApiUrl: z.string().max(500).default(""),
});

export type Account = z.infer<typeof AccountSchema>;

const AppSettingsSchema = z.object({
  activeAccountId: z.string().default(""),
  accounts: z.array(AccountSchema).default([]),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

const STORAGE_KEY = "app-settings";

function createDefaultAccount(): Account {
  return {
    id: crypto.randomUUID(),
    name: "الحساب الرئيسي",
    email: "",
    apiProvider: "lovable",
    googleApiKey: "",
    openaiApiKey: "",
    customApiKey: "",
    customApiUrl: "",
  };
}

function migrateOldSettings(stored: any): AppSettings | null {
  // Migrate from old single-account format
  if (stored && typeof stored === "object" && !stored.accounts) {
    const account: Account = {
      id: crypto.randomUUID(),
      name: "الحساب الرئيسي",
      email: stored.email || "",
      apiProvider: stored.apiProvider || "lovable",
      googleApiKey: stored.googleApiKey || "",
      openaiApiKey: stored.openaiApiKey || "",
      customApiKey: stored.customApiKey || "",
      customApiUrl: stored.customApiUrl || "",
    };
    return {
      activeAccountId: account.id,
      accounts: [account],
    };
  }
  return null;
}

const defaultSettings: AppSettings = (() => {
  const account = createDefaultAccount();
  return {
    activeAccountId: account.id,
    accounts: [account],
  };
})();

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return defaultSettings;
      const parsed = JSON.parse(stored);
      
      // Try migration from old format
      const migrated = migrateOldSettings(parsed);
      if (migrated) return migrated;
      
      const validated = AppSettingsSchema.safeParse(parsed);
      if (validated.success && validated.data.accounts.length > 0) {
        return validated.data;
      }
      return defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const activeAccount = settings.accounts.find(a => a.id === settings.activeAccountId) || settings.accounts[0];

  const setActiveAccount = useCallback((id: string) => {
    setSettings(prev => ({ ...prev, activeAccountId: id }));
  }, []);

  const addAccount = useCallback(() => {
    const newAccount = createDefaultAccount();
    newAccount.name = `حساب ${settings.accounts.length + 1}`;
    setSettings(prev => ({
      ...prev,
      accounts: [...prev.accounts, newAccount],
      activeAccountId: newAccount.id,
    }));
    return newAccount;
  }, [settings.accounts.length]);

  const removeAccount = useCallback((id: string) => {
    setSettings(prev => {
      if (prev.accounts.length <= 1) return prev;
      const filtered = prev.accounts.filter(a => a.id !== id);
      return {
        ...prev,
        accounts: filtered,
        activeAccountId: prev.activeAccountId === id ? filtered[0].id : prev.activeAccountId,
      };
    });
  }, []);

  const updateAccount = useCallback((id: string, partial: Partial<Account>) => {
    setSettings(prev => ({
      ...prev,
      accounts: prev.accounts.map(a => a.id === id ? { ...a, ...partial } : a),
    }));
  }, []);

  const updateActiveAccount = useCallback((partial: Partial<Account>) => {
    setSettings(prev => ({
      ...prev,
      accounts: prev.accounts.map(a => a.id === prev.activeAccountId ? { ...a, ...partial } : a),
    }));
  }, []);

  const getActiveApiKey = useCallback((): { provider: string; apiKey: string; apiUrl?: string } | null => {
    if (!activeAccount) return null;
    switch (activeAccount.apiProvider) {
      case "google":
        return activeAccount.googleApiKey ? { provider: "google", apiKey: activeAccount.googleApiKey } : null;
      case "openai":
        return activeAccount.openaiApiKey ? { provider: "openai", apiKey: activeAccount.openaiApiKey } : null;
      case "custom":
        return activeAccount.customApiKey ? { provider: "custom", apiKey: activeAccount.customApiKey, apiUrl: activeAccount.customApiUrl } : null;
      default:
        return null;
    }
  }, [activeAccount]);

  return {
    settings,
    activeAccount,
    setActiveAccount,
    addAccount,
    removeAccount,
    updateAccount,
    updateActiveAccount,
    getActiveApiKey,
  };
}
