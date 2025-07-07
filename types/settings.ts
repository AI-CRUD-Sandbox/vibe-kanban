/**
 * Settings types for Vibe Kanban application
 */

export type Theme = 'light' | 'dark' | 'system';

export interface AIServiceConfig {
  name: string;
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface AIServices {
  aider: AIServiceConfig;
  claudeCode: AIServiceConfig;
  openRouter: AIServiceConfig;
  openAI: AIServiceConfig;
}

export interface AppSettings {
  // Theme settings
  theme: Theme;
  
  // AI Integration settings
  aiServices: AIServices;
  defaultAIService: keyof AIServices;
  
  // Application settings
  autoSave: boolean;
  autoSaveInterval: number; // in seconds
  
  // UI settings
  compactMode: boolean;
  showTaskCount: boolean;
  enableAnimations: boolean;
  
  // Backup settings
  enableAutoBackup: boolean;
  backupInterval: number; // in minutes
  maxBackups: number;
  
  // Session settings
  sessionTimeout: number; // in minutes
  enableSessionHistory: boolean;
  maxSessionHistory: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  aiServices: {
    aider: {
      name: 'Aider',
      apiKey: '',
      enabled: false,
    },
    claudeCode: {
      name: 'Claude Code',
      apiKey: '',
      enabled: false,
    },
    openRouter: {
      name: 'OpenRouter',
      apiKey: '',
      baseUrl: 'https://openrouter.ai/api/v1',
      enabled: false,
    },
    openAI: {
      name: 'OpenAI',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      enabled: false,
    },
  },
  defaultAIService: 'openAI',
  autoSave: true,
  autoSaveInterval: 30,
  compactMode: false,
  showTaskCount: true,
  enableAnimations: true,
  enableAutoBackup: true,
  backupInterval: 5,
  maxBackups: 10,
  sessionTimeout: 60,
  enableSessionHistory: true,
  maxSessionHistory: 50,
};

export interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  exportSettings: () => string;
  importSettings: (settingsJson: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}
