import React, { useState, useCallback } from 'react';
import { Project, ProjectTemplate, DEFAULT_PROJECT_COLORS, DEFAULT_PROJECT_ICONS } from '../types/project';

interface ProjectManagerProps {
  isOpen: boolean;
  projects: Project[];
  templates: ProjectTemplate[];
  onClose: () => void;
  onCreateProject: (name: string, template?: ProjectTemplate) => Promise<Project | null>;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => Promise<boolean>;
  onDeleteProject: (projectId: string) => Promise<boolean>;
  onDuplicateProject: (projectId: string, newName: string) => Promise<Project | null>;
  onExportProject: (projectId: string) => Promise<void>;
  onImportProject: (file: File) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const ProjectManager: React.FC<ProjectManagerProps> = ({
  isOpen,
  projects,
  templates,
  onClose,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onDuplicateProject,
  onExportProject,
  onImportProject,
  isLoading,
  error,
}) => {
  const [activeTab, setActiveTab] = useState<'projects' | 'templates' | 'import'>('projects');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;

    try {
      const project = await onCreateProject(newProjectName.trim(), selectedTemplate || undefined);
      if (project) {
        setNewProjectName('');
        setSelectedTemplate(null);
        setShowCreateForm(false);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  }, [newProjectName, selectedTemplate, onCreateProject]);

  const handleUpdateProject = useCallback(async (project: Project, updates: Partial<Project>) => {
    try {
      await onUpdateProject(project.id, updates);
      setEditingProject(null);
    } catch (error) {
      console.error('Failed to update project:', error);
    }
  }, [onUpdateProject]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      try {
        await onDeleteProject(projectId);
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    }
  }, [onDeleteProject]);

  const handleFileImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportProject(file);
      event.target.value = ''; // Reset file input
    }
  }, [onImportProject]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-sky-400">Project Manager</h2>
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

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {[
            { id: 'projects', label: 'Projects', count: projects.length },
            { id: 'templates', label: 'Templates', count: templates.length },
            { id: 'import', label: 'Import/Export', count: null },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-sky-400 border-b-2 border-sky-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-2 px-2 py-1 bg-gray-700 text-xs rounded">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'projects' && (
            <div className="space-y-6">
              {/* Create Project Button */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Your Projects</h3>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-500 transition-colors"
                >
                  Create New Project
                </button>
              </div>

              {/* Create Project Form */}
              {showCreateForm && (
                <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                  <h4 className="font-medium text-white mb-4">Create New Project</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Project Name</label>
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="Enter project name..."
                        className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Template (Optional)</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <button
                          onClick={() => setSelectedTemplate(null)}
                          className={`p-3 border rounded-lg text-left transition-colors ${
                            selectedTemplate === null
                              ? 'border-sky-400 bg-sky-900/20'
                              : 'border-gray-600 hover:border-gray-500'
                          }`}
                        >
                          <div className="text-2xl mb-2">📋</div>
                          <div className="font-medium text-white">Blank Project</div>
                          <div className="text-xs text-gray-400">Start from scratch</div>
                        </button>
                        
                        {templates.map(template => (
                          <button
                            key={template.id}
                            onClick={() => setSelectedTemplate(template)}
                            className={`p-3 border rounded-lg text-left transition-colors ${
                              selectedTemplate?.id === template.id
                                ? 'border-sky-400 bg-sky-900/20'
                                : 'border-gray-600 hover:border-gray-500'
                            }`}
                          >
                            <div className="text-2xl mb-2">{template.icon}</div>
                            <div className="font-medium text-white">{template.name}</div>
                            <div className="text-xs text-gray-400">{template.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={handleCreateProject}
                        disabled={!newProjectName.trim() || isLoading}
                        className="px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-500 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? 'Creating...' : 'Create Project'}
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateForm(false);
                          setNewProjectName('');
                          setSelectedTemplate(null);
                        }}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Projects List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map(project => (
                  <div key={project.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{project.icon}</span>
                        <div>
                          <h4 className="font-medium text-white">{project.name}</h4>
                          <p className="text-xs text-gray-400">
                            {project.metadata.taskCount} tasks • {project.metadata.completedTasks} done
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex space-x-1">
                        <button
                          onClick={() => onExportProject(project.id)}
                          className="p-1 text-gray-400 hover:text-sky-400 transition-colors"
                          title="Export Project"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete Project"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {project.description && (
                      <p className="text-sm text-gray-300 mb-3">{project.description}</p>
                    )}
                    
                    <div className="text-xs text-gray-400">
                      Created {project.createdAt.toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white">Project Templates</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(template => (
                  <div key={template.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <div className="text-3xl mb-3">{template.icon}</div>
                    <h4 className="font-medium text-white mb-2">{template.name}</h4>
                    <p className="text-sm text-gray-300 mb-3">{template.description}</p>
                    
                    <div className="flex flex-wrap gap-1 mb-3">
                      {template.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 bg-gray-600 text-xs text-gray-300 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => {
                        setSelectedTemplate(template);
                        setShowCreateForm(true);
                        setActiveTab('projects');
                      }}
                      className="w-full px-3 py-2 bg-sky-600 text-white rounded text-sm hover:bg-sky-500 transition-colors"
                    >
                      Use Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white">Import & Export</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                  <h4 className="font-medium text-white mb-4">Import Project</h4>
                  <p className="text-sm text-gray-300 mb-4">
                    Import a project from a previously exported JSON file.
                  </p>
                  
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileImport}
                    className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-sky-600 file:text-white file:cursor-pointer"
                  />
                </div>
                
                <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                  <h4 className="font-medium text-white mb-4">Export Projects</h4>
                  <p className="text-sm text-gray-300 mb-4">
                    Export individual projects to share or backup.
                  </p>
                  
                  <div className="space-y-2">
                    {projects.map(project => (
                      <button
                        key={project.id}
                        onClick={() => onExportProject(project.id)}
                        className="w-full p-2 bg-gray-800 hover:bg-gray-600 rounded text-left text-white transition-colors flex items-center space-x-3"
                      >
                        <span>{project.icon}</span>
                        <span>{project.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectManager;
