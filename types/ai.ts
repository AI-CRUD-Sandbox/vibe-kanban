/**
 * AI Integration types for Vibe Kanban application
 */

export type AIServiceType = 'openAI' | 'claudeCode' | 'openRouter' | 'aider';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    tokens?: number;
    model?: string;
    cost?: number;
    processingTime?: number;
  };
}

export interface AISession {
  id: string;
  title: string;
  projectId: string;
  service: AIServiceType;
  model?: string;
  messages: AIMessage[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  metadata?: {
    totalTokens: number;
    totalCost: number;
    messageCount: number;
    lastActivity: Date;
  };
}

export interface AIServiceConfig {
  type: AIServiceType;
  name: string;
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
  models: string[];
  defaultModel: string;
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    requestsPerDay: number;
  };
  pricing: {
    inputTokenCost: number; // per 1000 tokens
    outputTokenCost: number; // per 1000 tokens
  };
}

export interface AIRequest {
  sessionId: string;
  message: string;
  context?: {
    taskId?: string;
    columnId?: string;
    projectContext?: string;
    codeContext?: string;
  };
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  };
}

export interface AIResponse {
  id: string;
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata: {
    processingTime: number;
    cost: number;
    service: AIServiceType;
  };
}

export interface TaskSuggestion {
  id: string;
  taskId: string;
  type: 'enhancement' | 'breakdown' | 'optimization' | 'completion';
  title: string;
  description: string;
  confidence: number; // 0-1
  aiService: AIServiceType;
  createdAt: Date;
  applied: boolean;
}

export interface CodeSuggestion {
  id: string;
  type: 'refactor' | 'optimize' | 'fix' | 'feature';
  title: string;
  description: string;
  code: string;
  language: string;
  confidence: number;
  aiService: AIServiceType;
  createdAt: Date;
  applied: boolean;
}

export interface AIUsageStats {
  sessionId: string;
  service: AIServiceType;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageResponseTime: number;
  successRate: number;
  lastUsed: Date;
  dailyUsage: {
    date: string;
    requests: number;
    tokens: number;
    cost: number;
  }[];
}

export interface AIServiceClient {
  type: AIServiceType;
  isConfigured: () => boolean;
  testConnection: () => Promise<boolean>;
  sendMessage: (request: AIRequest) => Promise<AIResponse>;
  streamMessage: (request: AIRequest) => AsyncGenerator<string, void, unknown>;
  getModels: () => Promise<string[]>;
  estimateCost: (tokens: number, model?: string) => number;
  getRateLimits: () => AIServiceConfig['rateLimits'];
}

export interface AIContextProvider {
  getTaskContext: (taskId: string) => Promise<string>;
  getProjectContext: (projectId: string) => Promise<string>;
  getCodeContext: (filePath?: string) => Promise<string>;
  getConversationContext: (sessionId: string, messageCount?: number) => Promise<string>;
}

export interface AISessionManager {
  createSession: (projectId: string, service: AIServiceType, title?: string) => Promise<AISession>;
  getSession: (sessionId: string) => Promise<AISession | null>;
  getSessions: (projectId: string) => Promise<AISession[]>;
  updateSession: (sessionId: string, updates: Partial<AISession>) => Promise<boolean>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  addMessage: (sessionId: string, message: AIMessage) => Promise<boolean>;
  getMessages: (sessionId: string, limit?: number) => Promise<AIMessage[]>;
  archiveSession: (sessionId: string) => Promise<boolean>;
  getActiveSession: (projectId: string) => Promise<AISession | null>;
  setActiveSession: (sessionId: string) => Promise<boolean>;
}

export interface AIIntegrationHook {
  // Session management
  sessions: AISession[];
  activeSession: AISession | null;
  isLoading: boolean;
  error: string | null;
  
  // Session operations
  createSession: (service: AIServiceType, title?: string) => Promise<AISession | null>;
  switchSession: (sessionId: string) => Promise<boolean>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  
  // Messaging
  sendMessage: (message: string, context?: AIRequest['context']) => Promise<AIResponse | null>;
  streamMessage: (message: string, context?: AIRequest['context']) => AsyncGenerator<string, void, unknown>;
  
  // Suggestions
  getTaskSuggestions: (taskId: string) => Promise<TaskSuggestion[]>;
  getCodeSuggestions: (code: string, language: string) => Promise<CodeSuggestion[]>;
  applySuggestion: (suggestionId: string) => Promise<boolean>;
  
  // Service management
  availableServices: AIServiceType[];
  switchService: (service: AIServiceType) => Promise<boolean>;
  testService: (service: AIServiceType) => Promise<boolean>;
  
  // Usage tracking
  getUsageStats: () => Promise<AIUsageStats[]>;
  getRemainingQuota: (service: AIServiceType) => Promise<number>;
}

export const AI_SERVICE_CONFIGS: Record<AIServiceType, Omit<AIServiceConfig, 'apiKey' | 'enabled'>> = {
  openAI: {
    type: 'openAI',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4',
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 150000,
      requestsPerDay: 10000,
    },
    pricing: {
      inputTokenCost: 0.03, // per 1000 tokens for gpt-4
      outputTokenCost: 0.06,
    },
  },
  claudeCode: {
    type: 'claudeCode',
    name: 'Claude Code',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-sonnet', 'claude-3-haiku'],
    defaultModel: 'claude-3-sonnet',
    rateLimits: {
      requestsPerMinute: 50,
      tokensPerMinute: 100000,
      requestsPerDay: 5000,
    },
    pricing: {
      inputTokenCost: 0.015,
      outputTokenCost: 0.075,
    },
  },
  openRouter: {
    type: 'openRouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['anthropic/claude-3-sonnet', 'openai/gpt-4', 'meta-llama/llama-3-70b'],
    defaultModel: 'anthropic/claude-3-sonnet',
    rateLimits: {
      requestsPerMinute: 100,
      tokensPerMinute: 200000,
      requestsPerDay: 20000,
    },
    pricing: {
      inputTokenCost: 0.015,
      outputTokenCost: 0.075,
    },
  },
  aider: {
    type: 'aider',
    name: 'Aider',
    baseUrl: 'http://localhost:8080/api',
    models: ['aider-default'],
    defaultModel: 'aider-default',
    rateLimits: {
      requestsPerMinute: 30,
      tokensPerMinute: 50000,
      requestsPerDay: 1000,
    },
    pricing: {
      inputTokenCost: 0.0,
      outputTokenCost: 0.0,
    },
  },
};

export const DEFAULT_AI_SETTINGS = {
  defaultService: 'openAI' as AIServiceType,
  autoSuggestTasks: true,
  autoSuggestCode: false,
  maxSessionHistory: 50,
  enableStreaming: true,
  defaultTemperature: 0.7,
  defaultMaxTokens: 2000,
};
