import { useState, useCallback, useEffect } from 'react';
import { 
  AIServiceType, 
  AIRequest, 
  AIResponse, 
  TaskSuggestion, 
  CodeSuggestion,
  AIIntegrationHook 
} from '../types/ai';
import { useSettings } from './useSettings';
import { useAISessions } from './useAISessions';
import { createAIClient } from '../services/aiClients';
import { createAIMessage } from '../utils/aiSession';

export const useAI = (projectId: string = 'default'): AIIntegrationHook => {
  const { settings } = useSettings();
  const {
    sessions,
    activeSession,
    isLoading: sessionsLoading,
    error: sessionsError,
    createSession,
    switchSession,
    deleteSession,
    addMessage,
  } = useAISessions(projectId);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskSuggestions, setTaskSuggestions] = useState<TaskSuggestion[]>([]);
  const [codeSuggestions, setCodeSuggestions] = useState<CodeSuggestion[]>([]);
  const [currentService, setCurrentService] = useState<AIServiceType>(settings.defaultAIService);

  // Get available services based on settings
  const availableServices = Object.entries(settings.aiServices)
    .filter(([_, config]) => config.enabled && config.apiKey)
    .map(([service]) => service as AIServiceType);

  // Update current service when settings change
  useEffect(() => {
    if (availableServices.includes(settings.defaultAIService)) {
      setCurrentService(settings.defaultAIService);
    } else if (availableServices.length > 0) {
      setCurrentService(availableServices[0]);
    }
  }, [settings.defaultAIService, availableServices]);

  // Create new session
  const handleCreateSession = useCallback(async (
    service: AIServiceType, 
    title?: string
  ) => {
    setError(null);
    try {
      const session = await createSession(service, title);
      if (session) {
        setCurrentService(service);
      }
      return session;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to create AI session';
      setError(errorMsg);
      return null;
    }
  }, [createSession]);

  // Switch service
  const switchService = useCallback(async (service: AIServiceType): Promise<boolean> => {
    setError(null);
    try {
      if (!availableServices.includes(service)) {
        setError(`${service} is not configured or enabled`);
        return false;
      }
      
      setCurrentService(service);
      
      // If there's an active session with a different service, create a new session
      if (activeSession && activeSession.service !== service) {
        await handleCreateSession(service, `${service} Session`);
      }
      
      return true;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to switch AI service';
      setError(errorMsg);
      return false;
    }
  }, [availableServices, activeSession, handleCreateSession]);

  // Test service connection
  const testService = useCallback(async (service: AIServiceType): Promise<boolean> => {
    setError(null);
    try {
      const client = createAIClient(service, settings);
      if (!client.isConfigured()) {
        setError(`${service} is not properly configured`);
        return false;
      }
      
      const isConnected = await client.testConnection();
      if (!isConnected) {
        setError(`Failed to connect to ${service}`);
      }
      return isConnected;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : `Failed to test ${service}`;
      setError(errorMsg);
      return false;
    }
  }, [settings]);

  // Send message
  const sendMessage = useCallback(async (
    message: string, 
    context?: AIRequest['context']
  ): Promise<AIResponse | null> => {
    if (!activeSession) {
      setError('No active AI session');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = createAIClient(currentService, settings);
      
      if (!client.isConfigured()) {
        throw new Error(`${currentService} is not properly configured`);
      }

      // Add user message to session
      const userMessage = createAIMessage('user', message);
      await addMessage(activeSession.id, userMessage);

      // Send request to AI service
      const request: AIRequest = {
        sessionId: activeSession.id,
        message,
        context,
        options: {
          model: settings.aiServices[currentService].name,
          temperature: 0.7,
          maxTokens: 2000,
        },
      };

      const response = await client.sendMessage(request);

      // Add AI response to session
      const aiMessage = createAIMessage('assistant', response.content, {
        tokens: response.usage.totalTokens,
        model: response.model,
        cost: response.metadata.cost,
        processingTime: response.metadata.processingTime,
      });
      await addMessage(activeSession.id, aiMessage);

      return response;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to send message';
      setError(errorMsg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [activeSession, currentService, settings, addMessage]);

  // Stream message (for real-time responses)
  const streamMessage = useCallback(async function* (
    message: string, 
    context?: AIRequest['context']
  ): AsyncGenerator<string, void, unknown> {
    if (!activeSession) {
      throw new Error('No active AI session');
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = createAIClient(currentService, settings);
      
      if (!client.isConfigured()) {
        throw new Error(`${currentService} is not properly configured`);
      }

      // Add user message to session
      const userMessage = createAIMessage('user', message);
      await addMessage(activeSession.id, userMessage);

      const request: AIRequest = {
        sessionId: activeSession.id,
        message,
        context,
        options: {
          model: settings.aiServices[currentService].name,
          temperature: 0.7,
          maxTokens: 2000,
          stream: true,
        },
      };

      let fullResponse = '';
      for await (const chunk of client.streamMessage(request)) {
        fullResponse += chunk;
        yield chunk;
      }

      // Add complete AI response to session
      const aiMessage = createAIMessage('assistant', fullResponse);
      await addMessage(activeSession.id, aiMessage);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to stream message';
      setError(errorMsg);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [activeSession, currentService, settings, addMessage]);

  // Get task suggestions
  const getTaskSuggestions = useCallback(async (taskId: string): Promise<TaskSuggestion[]> => {
    setError(null);
    try {
      // This would typically call the backend API
      // For now, return mock suggestions
      const mockSuggestions: TaskSuggestion[] = [
        {
          id: `suggestion_${Date.now()}_1`,
          taskId,
          type: 'enhancement',
          title: 'Add acceptance criteria',
          description: 'Consider adding specific acceptance criteria to make this task more actionable and testable.',
          confidence: 0.8,
          aiService: currentService,
          createdAt: new Date(),
          applied: false,
        },
        {
          id: `suggestion_${Date.now()}_2`,
          taskId,
          type: 'breakdown',
          title: 'Break into smaller tasks',
          description: 'This task seems complex. Consider breaking it down into 2-3 smaller, more manageable subtasks.',
          confidence: 0.7,
          aiService: currentService,
          createdAt: new Date(),
          applied: false,
        },
      ];
      
      setTaskSuggestions(prev => [...prev, ...mockSuggestions]);
      return mockSuggestions;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to get task suggestions';
      setError(errorMsg);
      return [];
    }
  }, [currentService]);

  // Get code suggestions
  const getCodeSuggestions = useCallback(async (
    code: string, 
    language: string
  ): Promise<CodeSuggestion[]> => {
    setError(null);
    try {
      // This would typically call the AI service to analyze code
      // For now, return mock suggestions
      const mockSuggestions: CodeSuggestion[] = [
        {
          id: `code_suggestion_${Date.now()}_1`,
          type: 'optimize',
          title: 'Optimize performance',
          description: 'Consider using memoization to improve performance of this function.',
          code: `// Optimized version with memoization\nconst memoizedFunction = useMemo(() => {\n  return ${code};\n}, [dependencies]);`,
          language,
          confidence: 0.75,
          aiService: currentService,
          createdAt: new Date(),
          applied: false,
        },
      ];
      
      setCodeSuggestions(prev => [...prev, ...mockSuggestions]);
      return mockSuggestions;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to get code suggestions';
      setError(errorMsg);
      return [];
    }
  }, [currentService]);

  // Apply suggestion
  const applySuggestion = useCallback(async (suggestionId: string): Promise<boolean> => {
    setError(null);
    try {
      // Mark suggestion as applied
      setTaskSuggestions(prev => 
        prev.map(s => s.id === suggestionId ? { ...s, applied: true } : s)
      );
      setCodeSuggestions(prev => 
        prev.map(s => s.id === suggestionId ? { ...s, applied: true } : s)
      );
      
      // In a real implementation, this would apply the suggestion to the actual task/code
      return true;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to apply suggestion';
      setError(errorMsg);
      return false;
    }
  }, []);

  // Get usage stats (mock implementation)
  const getUsageStats = useCallback(async () => {
    // This would typically fetch from backend
    return [];
  }, []);

  // Get remaining quota (mock implementation)
  const getRemainingQuota = useCallback(async (service: AIServiceType): Promise<number> => {
    const client = createAIClient(service, settings);
    const rateLimits = client.getRateLimits();
    return rateLimits.requestsPerDay; // Simplified
  }, [settings]);

  return {
    // Session management
    sessions,
    activeSession,
    isLoading: isLoading || sessionsLoading,
    error: error || sessionsError,
    
    // Session operations
    createSession: handleCreateSession,
    switchSession,
    deleteSession,
    
    // Messaging
    sendMessage,
    streamMessage,
    
    // Suggestions
    getTaskSuggestions,
    getCodeSuggestions,
    applySuggestion,
    
    // Service management
    availableServices,
    switchService,
    testService,
    
    // Usage tracking
    getUsageStats,
    getRemainingQuota,
  };
};
