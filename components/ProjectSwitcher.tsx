import React, { useState, useRef, useEffect } from 'react';
import { Project } from '../types/project';

interface ProjectSwitcherProps {
  projects: Project[];
  currentProject: Project | null;
  onSwitchProject: (projectId: string) => void;
  onCreateProject: () => void;
  onManageProjects: () => void;
  isLoading?: boolean;
}

const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({
  projects,
  currentProject,
  onSwitchProject,
  onCreateProject,
  onManageProjects,
  isLoading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProjectSelect = (projectId: string) => {
    onSwitchProject(projectId);
    setIsOpen(false);
  };

  const formatLastActivity = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Current Project Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center space-x-3 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 min-w-[200px]"
      >
        {currentProject ? (
          <>
            <span className="text-2xl">{currentProject.icon}</span>
            <div className="flex-1 text-left">
              <div className="font-medium text-white truncate">
                {currentProject.name}
              </div>
              <div className="text-xs text-gray-400">
                {currentProject.metadata.taskCount} tasks
              </div>
            </div>
          </>
        ) : (
          <>
            <span className="text-2xl">📋</span>
            <div className="flex-1 text-left">
              <div className="font-medium text-white">
                {isLoading ? 'Loading...' : 'No Project'}
              </div>
              <div className="text-xs text-gray-400">
                Select a project
              </div>
            </div>
          </>
        )}
        
        <svg 
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-white">Projects</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    onCreateProject();
                    setIsOpen(false);
                  }}
                  className="p-1 text-gray-400 hover:text-sky-400 transition-colors"
                  title="Create New Project"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    onManageProjects();
                    setIsOpen(false);
                  }}
                  className="p-1 text-gray-400 hover:text-sky-400 transition-colors"
                  title="Manage Projects"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Project List */}
          <div className="py-2">
            {projects.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400">
                <div className="text-4xl mb-2">📋</div>
                <p className="text-sm">No projects yet</p>
                <button
                  onClick={() => {
                    onCreateProject();
                    setIsOpen(false);
                  }}
                  className="mt-3 px-3 py-1 bg-sky-600 text-white rounded text-sm hover:bg-sky-500 transition-colors"
                >
                  Create First Project
                </button>
              </div>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleProjectSelect(project.id)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors flex items-center space-x-3 ${
                    currentProject?.id === project.id ? 'bg-gray-700 border-r-2 border-sky-400' : ''
                  }`}
                >
                  <span className="text-2xl">{project.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-white truncate">
                        {project.name}
                      </h4>
                      {currentProject?.id === project.id && (
                        <span className="text-xs text-sky-400 ml-2">Current</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                      <span>
                        {project.metadata.taskCount} tasks • {project.metadata.completedTasks} done
                      </span>
                      <span>
                        {formatLastActivity(project.metadata.lastActivity)}
                      </span>
                    </div>
                    {project.description && (
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        {project.description}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {projects.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-700">
              <button
                onClick={() => {
                  onCreateProject();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 bg-sky-600 text-white rounded text-sm hover:bg-sky-500 transition-colors flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>New Project</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectSwitcher;
