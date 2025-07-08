import React, { useState, useCallback } from 'react';
import { AppSettings, Theme } from '../types/settings';

interface SettingsProps {
  isOpen: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSave: (settings: Partial<AppSettings>) => Promise<void>;
  onReset: () => Promise<void>;
  onExport: () => string;
  onImport: (settingsJson: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

const Settings: React.FC<SettingsProps> = ({
  isOpen,
  settings,
  onClose,
  onSave,
  onReset,
  onExport,
  onImport,
  isLoading,
  error,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'backup' | 'advanced'>('general');
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [importText, setImportText] = useState('');

  // Update local settings when props change
  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = useCallback(async () => {
    try {
      await onSave(localSettings);
      onClose();
    } catch (e) {
      // Error is handled by the parent component
    }
  }, [localSettings, onSave, onClose]);

  const handleReset = useCallback(async () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      try {
        await onReset();
        onClose();
      } catch (e) {
        // Error is handled by the parent component
      }
    }
  }, [onReset, onClose]);

  const handleExport = useCallback(() => {
    const settingsJson = onExport();
    const blob = new Blob([settingsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vibe-kanban-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [onExport]);

  const handleImport = useCallback(async () => {
    if (importText.trim()) {
      const success = await onImport(importText.trim());
      if (success) {
        setImportText('');
        onClose();
      }
    }
  }, [importText, onImport, onClose]);

  const updateLocalSetting = useCallback(<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateAIService = useCallback((
    service: keyof AppSettings['aiServices'],
    updates: Partial<AppSettings['aiServices'][typeof service]>
  ) => {
    setLocalSettings(prev => ({
      ...prev,
      aiServices: {
        ...prev.aiServices,
        [service]: { ...prev.aiServices[service], ...updates }
      }
    }));
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-sky-400">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-800 text-white p-3 mx-6 mt-4 rounded">
            {error}
          </div>
        )}

        <div className="flex h-[calc(90vh-8rem)]">
          {/* Sidebar */}
          <div className="w-64 bg-gray-900 p-4">
            <nav className="space-y-2">
              {[
                { id: 'general', label: 'General', icon: '⚙️' },
                { id: 'ai', label: 'AI Services', icon: '🤖' },
                { id: 'backup', label: 'Backup & Sync', icon: '💾' },
                { id: 'advanced', label: 'Advanced', icon: '🔧' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-sky-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span className="mr-3">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-white mb-4">General Settings</h3>
                
                {/* Theme */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Theme</label>
                  <select
                    value={localSettings.theme}
                    onChange={(e) => updateLocalSetting('theme', e.target.value as Theme)}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>

                {/* UI Settings */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-white">User Interface</h4>
                  
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={localSettings.compactMode}
                      onChange={(e) => updateLocalSetting('compactMode', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-gray-300">Compact mode</span>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={localSettings.showTaskCount}
                      onChange={(e) => updateLocalSetting('showTaskCount', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-gray-300">Show task count in columns</span>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={localSettings.enableAnimations}
                      onChange={(e) => updateLocalSetting('enableAnimations', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-gray-300">Enable animations</span>
                  </label>
                </div>

                {/* Auto-save */}
                <div>
                  <label className="flex items-center space-x-3 mb-2">
                    <input
                      type="checkbox"
                      checked={localSettings.autoSave}
                      onChange={(e) => updateLocalSetting('autoSave', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-gray-300">Enable auto-save</span>
                  </label>
                  
                  {localSettings.autoSave && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Auto-save interval (seconds)
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="300"
                        value={localSettings.autoSaveInterval}
                        onChange={(e) => updateLocalSetting('autoSaveInterval', parseInt(e.target.value))}
                        className="w-32 p-2 bg-gray-700 border border-gray-600 rounded text-white"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-white">AI Services</h3>
                  <button
                    onClick={() => setShowApiKeys(!showApiKeys)}
                    className="text-sm text-sky-400 hover:text-sky-300"
                  >
                    {showApiKeys ? 'Hide' : 'Show'} API Keys
                  </button>
                </div>

                {/* Default AI Service */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Default AI Service
                  </label>
                  <select
                    value={localSettings.defaultAIService}
                    onChange={(e) => updateLocalSetting('defaultAIService', e.target.value as keyof AppSettings['aiServices'])}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                  >
                    {Object.entries(localSettings.aiServices).map(([key, service]) => (
                      <option key={key} value={key}>{service.name}</option>
                    ))}
                  </select>
                </div>

                {/* AI Services Configuration */}
                {Object.entries(localSettings.aiServices).map(([key, service]) => (
                  <div key={key} className="border border-gray-600 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-medium text-white">{service.name}</h4>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={service.enabled}
                          onChange={(e) => updateAIService(key as keyof AppSettings['aiServices'], { enabled: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-gray-300">Enabled</span>
                      </label>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">API Key</label>
                        <input
                          type={showApiKeys ? "text" : "password"}
                          value={service.apiKey}
                          onChange={(e) => updateAIService(key as keyof AppSettings['aiServices'], { apiKey: e.target.value })}
                          placeholder="Enter API key..."
                          className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                        />
                      </div>

                      {service.baseUrl && (
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Base URL</label>
                          <input
                            type="text"
                            value={service.baseUrl}
                            onChange={(e) => updateAIService(key as keyof AppSettings['aiServices'], { baseUrl: e.target.value })}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add other tabs content here */}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-700">
          <div className="flex space-x-3">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
            >
              Export
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500 transition-colors"
            >
              Reset
            </button>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-500 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
