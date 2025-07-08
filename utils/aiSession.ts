/**
 * AI Session management utilities
 */
import { AISession, AIMessage, AIServiceType } from '../types/ai';

// Generate unique session ID
export const generateSessionId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `ai_session_${timestamp}_${randomPart}`;
};

// Generate unique message ID
export const generateMessageId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `msg_${timestamp}_${randomPart}`;
};

// Create a new AI session
export const createAISession = (
  projectId: string,
  service: AIServiceType,
  title?: string
): AISession => {
  const now = new Date();
  const sessionId = generateSessionId();
  
  return {
    id: sessionId,
    title: title || `AI Session ${new Date().toLocaleString()}`,
    projectId,
    service,
    messages: [],
    createdAt: now,
    updatedAt: now,
    isActive: true,
    metadata: {
      totalTokens: 0,
      totalCost: 0,
      messageCount: 0,
      lastActivity: now,
    },
  };
};

// Create a new AI message
export const createAIMessage = (
  role: AIMessage['role'],
  content: string,
  metadata?: AIMessage['metadata']
): AIMessage => {
  return {
    id: generateMessageId(),
    role,
    content,
    timestamp: new Date(),
    metadata,
  };
};

// Session storage keys
const SESSIONS_STORAGE_KEY = 'vibe-kanban-ai-sessions';
const ACTIVE_SESSION_STORAGE_KEY = 'vibe-kanban-active-ai-session';

// Local storage utilities for sessions
export const sessionStorage = {
  // Get all sessions for a project
  getSessions: (projectId: string): AISession[] => {
    try {
      const stored = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (!stored) return [];
      
      const allSessions: AISession[] = JSON.parse(stored);
      return allSessions
        .filter(session => session.projectId === projectId)
        .map(session => ({
          ...session,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt),
          messages: session.messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
          metadata: session.metadata ? {
            ...session.metadata,
            lastActivity: new Date(session.metadata.lastActivity),
          } : undefined,
        }));
    } catch (error) {
      console.error('Failed to load AI sessions:', error);
      return [];
    }
  },

  // Save sessions
  saveSessions: (projectId: string, sessions: AISession[]): boolean => {
    try {
      // Get all sessions from storage
      const stored = localStorage.getItem(SESSIONS_STORAGE_KEY);
      let allSessions: AISession[] = stored ? JSON.parse(stored) : [];
      
      // Remove existing sessions for this project
      allSessions = allSessions.filter(session => session.projectId !== projectId);
      
      // Add updated sessions for this project
      allSessions.push(...sessions);
      
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(allSessions));
      return true;
    } catch (error) {
      console.error('Failed to save AI sessions:', error);
      return false;
    }
  },

  // Get a specific session
  getSession: (sessionId: string): AISession | null => {
    try {
      const stored = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (!stored) return null;
      
      const allSessions: AISession[] = JSON.parse(stored);
      const session = allSessions.find(s => s.id === sessionId);
      
      if (!session) return null;
      
      return {
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        messages: session.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
        metadata: session.metadata ? {
          ...session.metadata,
          lastActivity: new Date(session.metadata.lastActivity),
        } : undefined,
      };
    } catch (error) {
      console.error('Failed to load AI session:', error);
      return null;
    }
  },

  // Update a session
  updateSession: (sessionId: string, updates: Partial<AISession>): boolean => {
    try {
      const stored = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (!stored) return false;
      
      const allSessions: AISession[] = JSON.parse(stored);
      const sessionIndex = allSessions.findIndex(s => s.id === sessionId);
      
      if (sessionIndex === -1) return false;
      
      allSessions[sessionIndex] = {
        ...allSessions[sessionIndex],
        ...updates,
        updatedAt: new Date(),
      };
      
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(allSessions));
      return true;
    } catch (error) {
      console.error('Failed to update AI session:', error);
      return false;
    }
  },

  // Delete a session
  deleteSession: (sessionId: string): boolean => {
    try {
      const stored = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (!stored) return false;
      
      const allSessions: AISession[] = JSON.parse(stored);
      const filteredSessions = allSessions.filter(s => s.id !== sessionId);
      
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(filteredSessions));
      return true;
    } catch (error) {
      console.error('Failed to delete AI session:', error);
      return false;
    }
  },

  // Add message to session
  addMessage: (sessionId: string, message: AIMessage): boolean => {
    try {
      const stored = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (!stored) return false;
      
      const allSessions: AISession[] = JSON.parse(stored);
      const sessionIndex = allSessions.findIndex(s => s.id === sessionId);
      
      if (sessionIndex === -1) return false;
      
      const session = allSessions[sessionIndex];
      session.messages.push(message);
      session.updatedAt = new Date();
      
      // Update metadata
      if (session.metadata) {
        session.metadata.messageCount = session.messages.length;
        session.metadata.lastActivity = new Date();
        if (message.metadata?.tokens) {
          session.metadata.totalTokens += message.metadata.tokens;
        }
        if (message.metadata?.cost) {
          session.metadata.totalCost += message.metadata.cost;
        }
      }
      
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(allSessions));
      return true;
    } catch (error) {
      console.error('Failed to add message to AI session:', error);
      return false;
    }
  },

  // Get active session for project
  getActiveSession: (projectId: string): string | null => {
    try {
      const stored = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      if (!stored) return null;
      
      const activeSessionMap: Record<string, string> = JSON.parse(stored);
      return activeSessionMap[projectId] || null;
    } catch (error) {
      console.error('Failed to get active AI session:', error);
      return null;
    }
  },

  // Set active session for project
  setActiveSession: (projectId: string, sessionId: string): boolean => {
    try {
      const stored = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      const activeSessionMap: Record<string, string> = stored ? JSON.parse(stored) : {};
      
      activeSessionMap[projectId] = sessionId;
      
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(activeSessionMap));
      return true;
    } catch (error) {
      console.error('Failed to set active AI session:', error);
      return false;
    }
  },

  // Clear active session for project
  clearActiveSession: (projectId: string): boolean => {
    try {
      const stored = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      if (!stored) return true;
      
      const activeSessionMap: Record<string, string> = JSON.parse(stored);
      delete activeSessionMap[projectId];
      
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(activeSessionMap));
      return true;
    } catch (error) {
      console.error('Failed to clear active AI session:', error);
      return false;
    }
  },
};

// Rate limiting utilities
export const rateLimiter = {
  // Check if request is within rate limits
  canMakeRequest: (service: AIServiceType): boolean => {
    const now = Date.now();
    const key = `ai_rate_limit_${service}`;
    const stored = localStorage.getItem(key);
    
    if (!stored) {
      // First request
      localStorage.setItem(key, JSON.stringify({
        requests: [now],
        lastReset: now,
      }));
      return true;
    }
    
    try {
      const data = JSON.parse(stored);
      const oneMinuteAgo = now - 60 * 1000;
      
      // Filter out requests older than 1 minute
      data.requests = data.requests.filter((timestamp: number) => timestamp > oneMinuteAgo);
      
      // Check rate limit (simplified - using 60 requests per minute for all services)
      if (data.requests.length >= 60) {
        return false;
      }
      
      // Add current request
      data.requests.push(now);
      localStorage.setItem(key, JSON.stringify(data));
      
      return true;
    } catch (error) {
      console.error('Rate limiter error:', error);
      return true; // Allow request on error
    }
  },

  // Get remaining requests for the current minute
  getRemainingRequests: (service: AIServiceType): number => {
    const now = Date.now();
    const key = `ai_rate_limit_${service}`;
    const stored = localStorage.getItem(key);
    
    if (!stored) return 60;
    
    try {
      const data = JSON.parse(stored);
      const oneMinuteAgo = now - 60 * 1000;
      
      // Filter out requests older than 1 minute
      const recentRequests = data.requests.filter((timestamp: number) => timestamp > oneMinuteAgo);
      
      return Math.max(0, 60 - recentRequests.length);
    } catch (error) {
      console.error('Rate limiter error:', error);
      return 60;
    }
  },
};
