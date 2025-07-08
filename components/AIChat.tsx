import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AISession, AIMessage, AIServiceType } from '../types/ai';
import { createAIMessage } from '../utils/aiSession';

interface AIChatProps {
  isOpen: boolean;
  session: AISession | null;
  availableServices: AIServiceType[];
  currentService: AIServiceType;
  onClose: () => void;
  onSendMessage: (message: string, context?: any) => Promise<void>;
  onSwitchService: (service: AIServiceType) => void;
  onNewSession: () => void;
  isLoading: boolean;
  error: string | null;
}

const AIChat: React.FC<AIChatProps> = ({
  isOpen,
  session,
  availableServices,
  currentService,
  onClose,
  onSendMessage,
  onSwitchService,
  onNewSession,
  isLoading,
  error,
}) => {
  const [message, setMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  // Focus textarea when chat opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || isLoading || !session) return;

    const userMessage = message.trim();
    setMessage('');
    setIsStreaming(true);

    try {
      await onSendMessage(userMessage);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsStreaming(false);
    }
  }, [message, isLoading, session, onSendMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  const getServiceIcon = (service: AIServiceType) => {
    switch (service) {
      case 'openAI': return '🤖';
      case 'claudeCode': return '🧠';
      case 'openRouter': return '🔀';
      case 'aider': return '⚡';
      default: return '🤖';
    }
  };

  const getServiceName = (service: AIServiceType) => {
    switch (service) {
      case 'openAI': return 'OpenAI';
      case 'claudeCode': return 'Claude Code';
      case 'openRouter': return 'OpenRouter';
      case 'aider': return 'Aider';
      default: return service;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-sky-400">AI Assistant</h2>
            {session && (
              <span className="text-sm text-gray-400">
                {session.title}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Service Selector */}
            <select
              value={currentService}
              onChange={(e) => onSwitchService(e.target.value as AIServiceType)}
              className="bg-gray-700 text-white rounded px-3 py-1 text-sm border border-gray-600"
            >
              {availableServices.map(service => (
                <option key={service} value={service}>
                  {getServiceIcon(service)} {getServiceName(service)}
                </option>
              ))}
            </select>

            {/* New Session Button */}
            <button
              onClick={onNewSession}
              className="px-3 py-1 bg-sky-600 text-white rounded text-sm hover:bg-sky-500 transition-colors"
            >
              New Chat
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-800 text-white p-3 mx-4 mt-2 rounded">
            {error}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!session ? (
            <div className="text-center text-gray-400 mt-8">
              <div className="text-4xl mb-4">🤖</div>
              <p>No active AI session</p>
              <button
                onClick={onNewSession}
                className="mt-4 px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-500 transition-colors"
              >
                Start New Chat
              </button>
            </div>
          ) : session.messages.length === 0 ? (
            <div className="text-center text-gray-400 mt-8">
              <div className="text-4xl mb-4">{getServiceIcon(currentService)}</div>
              <p>Start a conversation with {getServiceName(currentService)}</p>
              <p className="text-sm mt-2">Ask questions about your tasks, get suggestions, or request help with code.</p>
            </div>
          ) : (
            session.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-sky-600 text-white'
                      : 'bg-gray-700 text-gray-100'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  <div className={`text-xs mt-2 ${
                    msg.role === 'user' ? 'text-sky-200' : 'text-gray-400'
                  }`}>
                    {formatTimestamp(msg.timestamp)}
                    {msg.metadata?.tokens && (
                      <span className="ml-2">• {msg.metadata.tokens} tokens</span>
                    )}
                    {msg.metadata?.cost && (
                      <span className="ml-2">• ${msg.metadata.cost.toFixed(4)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Streaming indicator */}
          {isStreaming && (
            <div className="flex justify-start">
              <div className="bg-gray-700 text-gray-100 rounded-lg p-3 max-w-[80%]">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm text-gray-400">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-700 p-4">
          <div className="flex space-x-3">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={session ? "Type your message..." : "Start a new chat first"}
              disabled={!session || isLoading}
              className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
              rows={3}
            />
            <button
              onClick={handleSendMessage}
              disabled={!message.trim() || isLoading || !session}
              className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          
          {session && (
            <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
              <span>
                {session.metadata?.messageCount || 0} messages • 
                {session.metadata?.totalTokens || 0} tokens • 
                ${(session.metadata?.totalCost || 0).toFixed(4)} cost
              </span>
              <span>Press Enter to send, Shift+Enter for new line</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIChat;
