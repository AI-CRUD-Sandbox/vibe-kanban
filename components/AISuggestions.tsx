import React, { useState, useCallback } from 'react';
import { TaskSuggestion, CodeSuggestion, AIServiceType } from '../types/ai';
import { Task } from '../types';

interface AISuggestionsProps {
  isOpen: boolean;
  taskSuggestions: TaskSuggestion[];
  codeSuggestions: CodeSuggestion[];
  selectedTask: Task | null;
  onClose: () => void;
  onApplySuggestion: (suggestionId: string, type: 'task' | 'code') => Promise<boolean>;
  onGenerateSuggestions: (taskId: string) => Promise<void>;
  onRefreshSuggestions: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const AISuggestions: React.FC<AISuggestionsProps> = ({
  isOpen,
  taskSuggestions,
  codeSuggestions,
  selectedTask,
  onClose,
  onApplySuggestion,
  onGenerateSuggestions,
  onRefreshSuggestions,
  isLoading,
  error,
}) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'code'>('tasks');
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);

  const handleApplySuggestion = useCallback(async (
    suggestionId: string, 
    type: 'task' | 'code'
  ) => {
    try {
      const success = await onApplySuggestion(suggestionId, type);
      if (success) {
        // Optionally show success feedback
        console.log('Suggestion applied successfully');
      }
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
    }
  }, [onApplySuggestion]);

  const getServiceIcon = (service: AIServiceType) => {
    switch (service) {
      case 'openAI': return '🤖';
      case 'claudeCode': return '🧠';
      case 'openRouter': return '🔀';
      case 'aider': return '⚡';
      default: return '🤖';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-sky-400">AI Suggestions</h2>
            {selectedTask && (
              <span className="text-sm text-gray-400">
                for "{selectedTask.title}"
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            {selectedTask && (
              <button
                onClick={() => onGenerateSuggestions(selectedTask.id)}
                disabled={isLoading}
                className="px-3 py-1 bg-sky-600 text-white rounded text-sm hover:bg-sky-500 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Generating...' : 'Generate'}
              </button>
            )}
            
            <button
              onClick={onRefreshSuggestions}
              disabled={isLoading}
              className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-500 transition-colors disabled:opacity-50"
            >
              Refresh
            </button>

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

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'tasks'
                ? 'text-sky-400 border-b-2 border-sky-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Task Suggestions ({taskSuggestions.length})
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'code'
                ? 'text-sky-400 border-b-2 border-sky-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Code Suggestions ({codeSuggestions.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              {taskSuggestions.length === 0 ? (
                <div className="text-center text-gray-400 mt-8">
                  <div className="text-4xl mb-4">💡</div>
                  <p>No task suggestions available</p>
                  {selectedTask && (
                    <button
                      onClick={() => onGenerateSuggestions(selectedTask.id)}
                      disabled={isLoading}
                      className="mt-4 px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-500 transition-colors disabled:opacity-50"
                    >
                      {isLoading ? 'Generating...' : 'Generate Suggestions'}
                    </button>
                  )}
                </div>
              ) : (
                taskSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="bg-gray-700 rounded-lg p-4 border border-gray-600"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">
                          {suggestion.type === 'enhancement' && '✨'}
                          {suggestion.type === 'breakdown' && '🔧'}
                          {suggestion.type === 'optimization' && '⚡'}
                          {suggestion.type === 'completion' && '✅'}
                        </span>
                        <h3 className="font-semibold text-white">{suggestion.title}</h3>
                        <span className={`text-xs px-2 py-1 rounded ${getConfidenceColor(suggestion.confidence)}`}>
                          {getConfidenceLabel(suggestion.confidence)}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-400">
                          {getServiceIcon(suggestion.aiService)} {formatDate(suggestion.createdAt)}
                        </span>
                        {!suggestion.applied && (
                          <button
                            onClick={() => handleApplySuggestion(suggestion.id, 'task')}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-500 transition-colors"
                          >
                            Apply
                          </button>
                        )}
                        {suggestion.applied && (
                          <span className="px-3 py-1 bg-gray-600 text-gray-300 rounded text-sm">
                            Applied
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {suggestion.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-4">
              {codeSuggestions.length === 0 ? (
                <div className="text-center text-gray-400 mt-8">
                  <div className="text-4xl mb-4">💻</div>
                  <p>No code suggestions available</p>
                  <p className="text-sm mt-2">Code suggestions will appear when working with code-related tasks.</p>
                </div>
              ) : (
                codeSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="bg-gray-700 rounded-lg p-4 border border-gray-600"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">
                          {suggestion.type === 'refactor' && '🔄'}
                          {suggestion.type === 'optimize' && '⚡'}
                          {suggestion.type === 'fix' && '🐛'}
                          {suggestion.type === 'feature' && '✨'}
                        </span>
                        <h3 className="font-semibold text-white">{suggestion.title}</h3>
                        <span className={`text-xs px-2 py-1 rounded ${getConfidenceColor(suggestion.confidence)}`}>
                          {getConfidenceLabel(suggestion.confidence)}
                        </span>
                        <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded">
                          {suggestion.language}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-400">
                          {getServiceIcon(suggestion.aiService)} {formatDate(suggestion.createdAt)}
                        </span>
                        <button
                          onClick={() => setExpandedSuggestion(
                            expandedSuggestion === suggestion.id ? null : suggestion.id
                          )}
                          className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-500 transition-colors"
                        >
                          {expandedSuggestion === suggestion.id ? 'Hide' : 'View'} Code
                        </button>
                        {!suggestion.applied && (
                          <button
                            onClick={() => handleApplySuggestion(suggestion.id, 'code')}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-500 transition-colors"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-gray-300 text-sm leading-relaxed mb-3">
                      {suggestion.description}
                    </p>

                    {expandedSuggestion === suggestion.id && (
                      <div className="bg-gray-800 rounded p-3 border border-gray-600">
                        <pre className="text-sm text-gray-100 overflow-x-auto">
                          <code>{suggestion.code}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AISuggestions;
