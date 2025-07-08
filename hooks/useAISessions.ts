import { useState, useEffect, useCallback } from 'react';
import { AISession, AIMessage, AIServiceType } from '../types/ai';
import { 
  sessionStorage, 
  createAISession, 
  createAIMessage,
  rateLimiter 
} from '../utils/aiSession';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface UseAISessionsResult {
  // Session state
  sessions: AISession[];
  activeSession: AISession | null;
  isLoading: boolean;
  error: string | null;
  
  // Session operations
  createSession: (service: AIServiceType, title?: string) => Promise<AISession | null>;
  loadSessions: () => Promise<void>;
  switchSession: (sessionId: string) => Promise<boolean>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  updateSessionTitle: (sessionId: string, title: string) => Promise<boolean>;
  
  // Message operations
  addMessage: (sessionId: string, message: AIMessage) => Promise<boolean>;
  getMessages: (sessionId: string) => AIMessage[];
  
  // Utility functions
  canMakeRequest: (service: AIServiceType) => boolean;
  getRemainingRequests: (service: AIServiceType) => number;
}

export const useAISessions = (projectId: string = 'default'): UseAISessionsResult => {
  const [sessions, setSessions] = useState<AISession[]>([]);
  const [activeSession, setActiveSession] = useState<AISession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load sessions from storage and backend
  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Load from local storage first
      const localSessions = sessionStorage.getSessions(projectId);
      setSessions(localSessions);
      
      // Load active session
      const activeSessionId = sessionStorage.getActiveSession(projectId);
      if (activeSessionId) {
        const activeSessionData = sessionStorage.getSession(activeSessionId);
        setActiveSession(activeSessionData);
      }
      
      // Try to sync with backend
      try {
        const response = await fetch(`${API_BASE_URL}/api/ai/sessions?projectId=${projectId}`);
        if (response.ok) {
          const backendSessions: AISession[] = await response.json();
          
          // Merge with local sessions (backend takes precedence)
          const mergedSessions = [...backendSessions];
          
          // Add any local sessions not in backend
          localSessions.forEach(localSession => {
            if (!backendSessions.find(s => s.id === localSession.id)) {
              mergedSessions.push(localSession);
            }
          });
          
          setSessions(mergedSessions);
          sessionStorage.saveSessions(projectId, mergedSessions);
        }
      } catch (e) {
        // Backend not available, continue with local sessions
        console.log('Backend AI sessions not available, using local storage');
      }
      
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load AI sessions');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Create a new session
  const createSession = useCallback(async (
    service: AIServiceType, 
    title?: string
  ): Promise<AISession | null> => {
    setError(null);
    
    try {
      const newSession = createAISession(projectId, service, title);
      
      // Save to local storage
      const updatedSessions = [...sessions, newSession];
      setSessions(updatedSessions);
      sessionStorage.saveSessions(projectId, updatedSessions);
      
      // Set as active session
      setActiveSession(newSession);
      sessionStorage.setActiveSession(projectId, newSession.id);
      
      // Try to save to backend
      try {
        await fetch(`${API_BASE_URL}/api/ai/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSession),
        });
      } catch (e) {
        console.log('Failed to save session to backend, using local storage only');
      }
      
      return newSession;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create AI session');
      return null;
    }
  }, [projectId, sessions]);

  // Switch to a different session
  const switchSession = useCallback(async (sessionId: string): Promise<boolean> => {
    setError(null);
    
    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) {
        setError('Session not found');
        return false;
      }
      
      setActiveSession(session);
      sessionStorage.setActiveSession(projectId, sessionId);
      
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to switch AI session');
      return false;
    }
  }, [projectId, sessions]);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string): Promise<boolean> => {
    setError(null);
    
    try {
      // Remove from local state
      const updatedSessions = sessions.filter(s => s.id !== sessionId);
      setSessions(updatedSessions);
      sessionStorage.saveSessions(projectId, updatedSessions);
      
      // Clear active session if it was deleted
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
        sessionStorage.clearActiveSession(projectId);
      }
      
      // Delete from local storage
      sessionStorage.deleteSession(sessionId);
      
      // Try to delete from backend
      try {
        await fetch(`${API_BASE_URL}/api/ai/sessions/${sessionId}`, {
          method: 'DELETE',
        });
      } catch (e) {
        console.log('Failed to delete session from backend');
      }
      
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete AI session');
      return false;
    }
  }, [projectId, sessions, activeSession]);

  // Update session title
  const updateSessionTitle = useCallback(async (
    sessionId: string, 
    title: string
  ): Promise<boolean> => {
    setError(null);
    
    try {
      const success = sessionStorage.updateSession(sessionId, { title });
      if (!success) {
        setError('Failed to update session title');
        return false;
      }
      
      // Update local state
      setSessions(prev => prev.map(session => 
        session.id === sessionId ? { ...session, title } : session
      ));
      
      if (activeSession?.id === sessionId) {
        setActiveSession(prev => prev ? { ...prev, title } : null);
      }
      
      // Try to update backend
      try {
        await fetch(`${API_BASE_URL}/api/ai/sessions/${sessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        });
      } catch (e) {
        console.log('Failed to update session title in backend');
      }
      
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update session title');
      return false;
    }
  }, [activeSession]);

  // Add message to session
  const addMessage = useCallback(async (
    sessionId: string, 
    message: AIMessage
  ): Promise<boolean> => {
    setError(null);
    
    try {
      const success = sessionStorage.addMessage(sessionId, message);
      if (!success) {
        setError('Failed to add message to session');
        return false;
      }
      
      // Update local state
      setSessions(prev => prev.map(session => {
        if (session.id === sessionId) {
          const updatedSession = {
            ...session,
            messages: [...session.messages, message],
            updatedAt: new Date(),
          };
          
          // Update metadata
          if (updatedSession.metadata) {
            updatedSession.metadata.messageCount = updatedSession.messages.length;
            updatedSession.metadata.lastActivity = new Date();
            if (message.metadata?.tokens) {
              updatedSession.metadata.totalTokens += message.metadata.tokens;
            }
            if (message.metadata?.cost) {
              updatedSession.metadata.totalCost += message.metadata.cost;
            }
          }
          
          return updatedSession;
        }
        return session;
      }));
      
      if (activeSession?.id === sessionId) {
        setActiveSession(prev => {
          if (!prev) return null;
          const updatedSession = {
            ...prev,
            messages: [...prev.messages, message],
            updatedAt: new Date(),
          };
          
          if (updatedSession.metadata) {
            updatedSession.metadata.messageCount = updatedSession.messages.length;
            updatedSession.metadata.lastActivity = new Date();
            if (message.metadata?.tokens) {
              updatedSession.metadata.totalTokens += message.metadata.tokens;
            }
            if (message.metadata?.cost) {
              updatedSession.metadata.totalCost += message.metadata.cost;
            }
          }
          
          return updatedSession;
        });
      }
      
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add message');
      return false;
    }
  }, [activeSession]);

  // Get messages for a session
  const getMessages = useCallback((sessionId: string): AIMessage[] => {
    const session = sessions.find(s => s.id === sessionId);
    return session?.messages || [];
  }, [sessions]);

  // Rate limiting utilities
  const canMakeRequest = useCallback((service: AIServiceType): boolean => {
    return rateLimiter.canMakeRequest(service);
  }, []);

  const getRemainingRequests = useCallback((service: AIServiceType): number => {
    return rateLimiter.getRemainingRequests(service);
  }, []);

  // Load sessions on mount and when projectId changes
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    activeSession,
    isLoading,
    error,
    createSession,
    loadSessions,
    switchSession,
    deleteSession,
    updateSessionTitle,
    addMessage,
    getMessages,
    canMakeRequest,
    getRemainingRequests,
  };
};
