import { useState, useEffect, useCallback } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '../types/settings';

const SETTINGS_STORAGE_KEY = 'vibe-kanban-settings';
const SETTINGS_API_ENDPOINT = '/api/settings';

// Simple encryption/decryption for API keys (base64 + simple cipher)
const encryptApiKey = (key: string): string => {
  if (!key) return '';
  const encoded = btoa(key);
  // Simple cipher - in production, use proper encryption
  return encoded.split('').reverse().join('');
};

const decryptApiKey = (encryptedKey: string): string => {
  if (!encryptedKey) return '';
  try {
    const reversed = encryptedKey.split('').reverse().join('');
    return atob(reversed);
  } catch {
    return '';
  }
};

// Encrypt sensitive data in settings
const encryptSettings = (settings: AppSettings): AppSettings => {
  const encrypted = { ...settings };
  encrypted.aiServices = {
    ...settings.aiServices,
    aider: { ...settings.aiServices.aider, apiKey: encryptApiKey(settings.aiServices.aider.apiKey) },
    claudeCode: { ...settings.aiServices.claudeCode, apiKey: encryptApiKey(settings.aiServices.claudeCode.apiKey) },
    openRouter: { ...settings.aiServices.openRouter, apiKey: encryptApiKey(settings.aiServices.openRouter.apiKey) },
    openAI: { ...settings.aiServices.openAI, apiKey: encryptApiKey(settings.aiServices.openAI.apiKey) },
  };
  return encrypted;
};

// Decrypt sensitive data from settings
const decryptSettings = (settings: AppSettings): AppSettings => {
  const decrypted = { ...settings };
  decrypted.aiServices = {
    ...settings.aiServices,
    aider: { ...settings.aiServices.aider, apiKey: decryptApiKey(settings.aiServices.aider.apiKey) },
    claudeCode: { ...settings.aiServices.claudeCode, apiKey: decryptApiKey(settings.aiServices.claudeCode.apiKey) },
    openRouter: { ...settings.aiServices.openRouter, apiKey: decryptApiKey(settings.aiServices.openRouter.apiKey) },
    openAI: { ...settings.aiServices.openAI, apiKey: decryptApiKey(settings.aiServices.openAI.apiKey) },
  };
  return decrypted;
};

export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings from localStorage and backend
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // First, try to load from localStorage
      const localSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      let loadedSettings = DEFAULT_SETTINGS;
      
      if (localSettings) {
        try {
          const parsed = JSON.parse(localSettings);
          loadedSettings = { ...DEFAULT_SETTINGS, ...decryptSettings(parsed) };
        } catch (e) {
          console.warn('Failed to parse local settings, using defaults');
        }
      }
      
      // Then, try to sync with backend (if available)
      try {
        const response = await fetch(SETTINGS_API_ENDPOINT);
        if (response.ok) {
          const backendSettings = await response.json();
          loadedSettings = { ...loadedSettings, ...decryptSettings(backendSettings) };
        }
      } catch (e) {
        // Backend not available, continue with local settings
        console.log('Backend settings not available, using local settings');
      }
      
      setSettings(loadedSettings);
      
      // Apply theme immediately
      applyTheme(loadedSettings.theme);
      
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save settings to localStorage and backend
  const saveSettings = useCallback(async (newSettings: AppSettings) => {
    try {
      const encryptedSettings = encryptSettings(newSettings);
      
      // Save to localStorage
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(encryptedSettings));
      
      // Try to save to backend
      try {
        await fetch(SETTINGS_API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(encryptedSettings),
        });
      } catch (e) {
        // Backend not available, continue with local storage
        console.log('Backend settings save failed, using local storage only');
      }
      
      // Apply theme if it changed
      applyTheme(newSettings.theme);
      
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to save settings');
    }
  }, []);

  // Apply theme to document
  const applyTheme = useCallback((theme: AppSettings['theme']) => {
    const root = document.documentElement;
    
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }, []);

  // Update settings
  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    setError(null);
    try {
      const newSettings = { ...settings, ...updates };
      await saveSettings(newSettings);
      setSettings(newSettings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update settings');
      throw e;
    }
  }, [settings, saveSettings]);

  // Reset settings to defaults
  const resetSettings = useCallback(async () => {
    setError(null);
    try {
      await saveSettings(DEFAULT_SETTINGS);
      setSettings(DEFAULT_SETTINGS);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset settings');
      throw e;
    }
  }, [saveSettings]);

  // Export settings as JSON
  const exportSettings = useCallback(() => {
    return JSON.stringify(settings, null, 2);
  }, [settings]);

  // Import settings from JSON
  const importSettings = useCallback(async (settingsJson: string): Promise<boolean> => {
    setError(null);
    try {
      const importedSettings = JSON.parse(settingsJson);
      const validatedSettings = { ...DEFAULT_SETTINGS, ...importedSettings };
      await saveSettings(validatedSettings);
      setSettings(validatedSettings);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import settings');
      return false;
    }
  }, [saveSettings]);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Listen for system theme changes
  useEffect(() => {
    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [settings.theme, applyTheme]);

  return {
    settings,
    updateSettings,
    resetSettings,
    exportSettings,
    importSettings,
    isLoading,
    error,
  };
};
