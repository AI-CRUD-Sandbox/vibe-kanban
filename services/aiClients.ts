/**
 * AI Service Client implementations
 */
import { 
  AIServiceClient, 
  AIRequest, 
  AIResponse, 
  AIServiceType, 
  AI_SERVICE_CONFIGS 
} from '../types/ai';
import { AppSettings } from '../types/settings';

// Base client class with common functionality
abstract class BaseAIClient implements AIServiceClient {
  abstract type: AIServiceType;
  protected settings: AppSettings;

  constructor(settings: AppSettings) {
    this.settings = settings;
  }

  abstract isConfigured(): boolean;
  abstract testConnection(): Promise<boolean>;
  abstract sendMessage(request: AIRequest): Promise<AIResponse>;
  abstract streamMessage(request: AIRequest): AsyncGenerator<string, void, unknown>;
  abstract getModels(): Promise<string[]>;

  estimateCost(tokens: number, model?: string): number {
    const config = AI_SERVICE_CONFIGS[this.type];
    // Simplified cost estimation (assuming equal input/output tokens)
    const avgCost = (config.pricing.inputTokenCost + config.pricing.outputTokenCost) / 2;
    return (tokens / 1000) * avgCost;
  }

  getRateLimits() {
    return AI_SERVICE_CONFIGS[this.type].rateLimits;
  }

  protected getApiKey(): string {
    return this.settings.aiServices[this.type].apiKey;
  }

  protected getBaseUrl(): string {
    return this.settings.aiServices[this.type].baseUrl || AI_SERVICE_CONFIGS[this.type].baseUrl!;
  }

  protected async makeRequest(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getApiKey()}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response;
  }
}

// OpenAI Client
class OpenAIClient extends BaseAIClient {
  type: AIServiceType = 'openAI';

  isConfigured(): boolean {
    return !!this.getApiKey() && this.settings.aiServices.openAI.enabled;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/models');
      return response.ok;
    } catch {
      return false;
    }
  }

  async sendMessage(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    
    const payload = {
      model: request.options?.model || AI_SERVICE_CONFIGS.openAI.defaultModel,
      messages: [
        { role: 'user', content: request.message }
      ],
      temperature: request.options?.temperature || 0.7,
      max_tokens: request.options?.maxTokens || 2000,
    };

    const response = await this.makeRequest('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    const processingTime = Date.now() - startTime;

    return {
      id: data.id,
      content: data.choices[0].message.content,
      model: data.model,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      metadata: {
        processingTime,
        cost: this.estimateCost(data.usage.total_tokens),
        service: this.type,
      },
    };
  }

  async *streamMessage(request: AIRequest): AsyncGenerator<string, void, unknown> {
    const payload = {
      model: request.options?.model || AI_SERVICE_CONFIGS.openAI.defaultModel,
      messages: [
        { role: 'user', content: request.message }
      ],
      temperature: request.options?.temperature || 0.7,
      max_tokens: request.options?.maxTokens || 2000,
      stream: true,
    };

    const response = await this.makeRequest('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await this.makeRequest('/models');
      const data = await response.json();
      return data.data
        .filter((model: any) => model.id.includes('gpt'))
        .map((model: any) => model.id);
    } catch {
      return AI_SERVICE_CONFIGS.openAI.models;
    }
  }
}

// Claude Code Client (Anthropic)
class ClaudeCodeClient extends BaseAIClient {
  type: AIServiceType = 'claudeCode';

  isConfigured(): boolean {
    return !!this.getApiKey() && this.settings.aiServices.claudeCode.enabled;
  }

  async testConnection(): Promise<boolean> {
    try {
      // Anthropic doesn't have a simple models endpoint, so we'll try a minimal request
      const response = await this.makeRequest('/messages', {
        method: 'POST',
        headers: {
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: AI_SERVICE_CONFIGS.claudeCode.defaultModel,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async sendMessage(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    
    const payload = {
      model: request.options?.model || AI_SERVICE_CONFIGS.claudeCode.defaultModel,
      max_tokens: request.options?.maxTokens || 2000,
      messages: [
        { role: 'user', content: request.message }
      ],
    };

    const response = await this.makeRequest('/messages', {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    const processingTime = Date.now() - startTime;

    return {
      id: data.id,
      content: data.content[0].text,
      model: data.model,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      metadata: {
        processingTime,
        cost: this.estimateCost(data.usage.input_tokens + data.usage.output_tokens),
        service: this.type,
      },
    };
  }

  async *streamMessage(request: AIRequest): AsyncGenerator<string, void, unknown> {
    // Anthropic streaming implementation would go here
    // For now, fall back to non-streaming
    const response = await this.sendMessage(request);
    yield response.content;
  }

  async getModels(): Promise<string[]> {
    return AI_SERVICE_CONFIGS.claudeCode.models;
  }
}

// OpenRouter Client
class OpenRouterClient extends BaseAIClient {
  type: AIServiceType = 'openRouter';

  isConfigured(): boolean {
    return !!this.getApiKey() && this.settings.aiServices.openRouter.enabled;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/models');
      return response.ok;
    } catch {
      return false;
    }
  }

  async sendMessage(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    
    const payload = {
      model: request.options?.model || AI_SERVICE_CONFIGS.openRouter.defaultModel,
      messages: [
        { role: 'user', content: request.message }
      ],
      temperature: request.options?.temperature || 0.7,
      max_tokens: request.options?.maxTokens || 2000,
    };

    const response = await this.makeRequest('/chat/completions', {
      method: 'POST',
      headers: {
        'HTTP-Referer': 'https://vibe-kanban.app',
        'X-Title': 'Vibe Kanban',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    const processingTime = Date.now() - startTime;

    return {
      id: data.id,
      content: data.choices[0].message.content,
      model: data.model,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      metadata: {
        processingTime,
        cost: this.estimateCost(data.usage.total_tokens),
        service: this.type,
      },
    };
  }

  async *streamMessage(request: AIRequest): AsyncGenerator<string, void, unknown> {
    // Similar to OpenAI implementation
    const payload = {
      model: request.options?.model || AI_SERVICE_CONFIGS.openRouter.defaultModel,
      messages: [
        { role: 'user', content: request.message }
      ],
      temperature: request.options?.temperature || 0.7,
      max_tokens: request.options?.maxTokens || 2000,
      stream: true,
    };

    const response = await this.makeRequest('/chat/completions', {
      method: 'POST',
      headers: {
        'HTTP-Referer': 'https://vibe-kanban.app',
        'X-Title': 'Vibe Kanban',
      },
      body: JSON.stringify(payload),
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await this.makeRequest('/models');
      const data = await response.json();
      return data.data.map((model: any) => model.id);
    } catch {
      return AI_SERVICE_CONFIGS.openRouter.models;
    }
  }
}

// Aider Client (Local)
class AiderClient extends BaseAIClient {
  type: AIServiceType = 'aider';

  isConfigured(): boolean {
    return this.settings.aiServices.aider.enabled;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async sendMessage(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    
    const payload = {
      message: request.message,
      context: request.context,
    };

    const response = await fetch(`${this.getBaseUrl()}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Aider API request failed: ${response.status}`);
    }

    const data = await response.json();
    const processingTime = Date.now() - startTime;

    return {
      id: data.id || `aider_${Date.now()}`,
      content: data.response,
      model: 'aider-default',
      usage: {
        promptTokens: data.tokens?.prompt || 0,
        completionTokens: data.tokens?.completion || 0,
        totalTokens: data.tokens?.total || 0,
      },
      metadata: {
        processingTime,
        cost: 0, // Aider is free
        service: this.type,
      },
    };
  }

  async *streamMessage(request: AIRequest): AsyncGenerator<string, void, unknown> {
    // Aider streaming would be implemented here if supported
    const response = await this.sendMessage(request);
    yield response.content;
  }

  async getModels(): Promise<string[]> {
    return AI_SERVICE_CONFIGS.aider.models;
  }
}

// Client factory
export const createAIClient = (
  service: AIServiceType, 
  settings: AppSettings
): AIServiceClient => {
  switch (service) {
    case 'openAI':
      return new OpenAIClient(settings);
    case 'claudeCode':
      return new ClaudeCodeClient(settings);
    case 'openRouter':
      return new OpenRouterClient(settings);
    case 'aider':
      return new AiderClient(settings);
    default:
      throw new Error(`Unsupported AI service: ${service}`);
  }
};

// Get all available clients
export const getAllAIClients = (settings: AppSettings): Record<AIServiceType, AIServiceClient> => {
  return {
    openAI: new OpenAIClient(settings),
    claudeCode: new ClaudeCodeClient(settings),
    openRouter: new OpenRouterClient(settings),
    aider: new AiderClient(settings),
  };
};
