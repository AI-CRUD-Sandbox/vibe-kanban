import { useState, useEffect, useCallback } from 'react';
import { 
  Project, 
  ProjectTemplate, 
  ProjectExport, 
  ProjectImportResult,
  ProjectBackup,
  ProjectStats,
  DEFAULT_PROJECT_SETTINGS,
  PROJECT_TEMPLATES,
  DEFAULT_PROJECT_COLORS,
  DEFAULT_PROJECT_ICONS,
  ProjectManagerHook 
} from '../types/project';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const CURRENT_PROJECT_KEY = 'vibe-kanban-current-project';

export const useProjects = (): ProjectManagerHook => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load projects from backend
  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/projects`);
      if (!response.ok) {
        throw new Error(`Failed to load projects: ${response.status}`);
      }
      
      const projectsData: Project[] = await response.json();
      
      // Convert date strings back to Date objects
      const processedProjects = projectsData.map(project => ({
        ...project,
        createdAt: new Date(project.createdAt),
        updatedAt: new Date(project.updatedAt),
        metadata: {
          ...project.metadata,
          lastActivity: new Date(project.metadata.lastActivity),
        },
      }));
      
      setProjects(processedProjects);
      
      // Set current project from localStorage or first project
      const savedProjectId = localStorage.getItem(CURRENT_PROJECT_KEY);
      const targetProject = savedProjectId 
        ? processedProjects.find(p => p.id === savedProjectId)
        : processedProjects[0];
      
      if (targetProject) {
        setCurrentProject(targetProject);
      }
      
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a new project
  const createProject = useCallback(async (
    name: string, 
    template?: ProjectTemplate
  ): Promise<Project | null> => {
    setError(null);
    
    try {
      const projectId = `project_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      const newProject: Project = {
        id: projectId,
        name: name.trim(),
        description: template?.description || '',
        color: template?.color || DEFAULT_PROJECT_COLORS[Math.floor(Math.random() * DEFAULT_PROJECT_COLORS.length)],
        icon: template?.icon || DEFAULT_PROJECT_ICONS[Math.floor(Math.random() * DEFAULT_PROJECT_ICONS.length)],
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        metadata: {
          taskCount: 0,
          completedTasks: 0,
          lastActivity: new Date(),
          tags: template?.tags || [],
        },
        settings: template?.settings || DEFAULT_PROJECT_SETTINGS,
      };
      
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.status}`);
      }
      
      const createdProject = await response.json();
      
      // Add default tasks if template provides them
      if (template?.defaultTasks) {
        for (const taskTemplate of template.defaultTasks) {
          try {
            await fetch(`${API_BASE_URL}/api/tasks?project_id=${projectId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: taskTemplate.title,
                description: taskTemplate.description,
                column_id: taskTemplate.columnId,
              }),
            });
          } catch (e) {
            console.warn('Failed to create default task:', e);
          }
        }
      }
      
      setProjects(prev => [...prev, createdProject]);
      setCurrentProject(createdProject);
      localStorage.setItem(CURRENT_PROJECT_KEY, createdProject.id);
      
      return createdProject;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create project');
      return null;
    }
  }, []);

  // Update project
  const updateProject = useCallback(async (
    projectId: string, 
    updates: Partial<Project>
  ): Promise<boolean> => {
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update project: ${response.status}`);
      }
      
      const updatedProject = await response.json();
      
      setProjects(prev => prev.map(p => 
        p.id === projectId ? { ...updatedProject, 
          createdAt: new Date(updatedProject.createdAt),
          updatedAt: new Date(updatedProject.updatedAt),
          metadata: {
            ...updatedProject.metadata,
            lastActivity: new Date(updatedProject.metadata.lastActivity),
          }
        } : p
      ));
      
      if (currentProject?.id === projectId) {
        setCurrentProject({ ...updatedProject,
          createdAt: new Date(updatedProject.createdAt),
          updatedAt: new Date(updatedProject.updatedAt),
          metadata: {
            ...updatedProject.metadata,
            lastActivity: new Date(updatedProject.metadata.lastActivity),
          }
        });
      }
      
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update project');
      return false;
    }
  }, [currentProject]);

  // Delete project
  const deleteProject = useCallback(async (projectId: string): Promise<boolean> => {
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete project: ${response.status}`);
      }
      
      setProjects(prev => prev.filter(p => p.id !== projectId));
      
      // Switch to another project if current project was deleted
      if (currentProject?.id === projectId) {
        const remainingProjects = projects.filter(p => p.id !== projectId);
        const newCurrentProject = remainingProjects[0] || null;
        setCurrentProject(newCurrentProject);
        
        if (newCurrentProject) {
          localStorage.setItem(CURRENT_PROJECT_KEY, newCurrentProject.id);
        } else {
          localStorage.removeItem(CURRENT_PROJECT_KEY);
        }
      }
      
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete project');
      return false;
    }
  }, [currentProject, projects]);

  // Switch to a different project
  const switchProject = useCallback(async (projectId: string): Promise<boolean> => {
    setError(null);
    
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        setError('Project not found');
        return false;
      }
      
      setCurrentProject(project);
      localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
      
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to switch project');
      return false;
    }
  }, [projects]);

  // Duplicate project
  const duplicateProject = useCallback(async (
    projectId: string, 
    newName: string
  ): Promise<Project | null> => {
    setError(null);
    
    try {
      const sourceProject = projects.find(p => p.id === projectId);
      if (!sourceProject) {
        setError('Source project not found');
        return null;
      }
      
      // Create new project with same settings
      const newProject = await createProject(newName, {
        id: 'custom',
        name: newName,
        description: sourceProject.description,
        category: 'custom',
        icon: sourceProject.icon,
        color: sourceProject.color,
        settings: sourceProject.settings,
        tags: sourceProject.metadata.tags,
      });
      
      return newProject;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to duplicate project');
      return null;
    }
  }, [projects, createProject]);

  // Export project (simplified implementation)
  const exportProject = useCallback(async (projectId: string): Promise<ProjectExport | null> => {
    setError(null);
    
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        setError('Project not found');
        return null;
      }
      
      // Get project tasks
      const tasksResponse = await fetch(`${API_BASE_URL}/api/tasks?project_id=${projectId}`);
      const tasks = tasksResponse.ok ? await tasksResponse.json() : {};
      
      // Get AI sessions
      const sessionsResponse = await fetch(`${API_BASE_URL}/api/ai/sessions?projectId=${projectId}`);
      const aiSessions = sessionsResponse.ok ? await sessionsResponse.json() : [];
      
      const exportData: ProjectExport = {
        version: '1.0.0',
        exportedAt: new Date(),
        exportedBy: 'user',
        project,
        tasks,
        aiSessions,
        settings: {} as any, // Would include app settings
        metadata: {
          totalTasks: Object.values(tasks).flat().length,
          totalSessions: aiSessions.length,
          fileSize: 0, // Would calculate actual size
          checksum: '', // Would generate checksum
        },
      };
      
      return exportData;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export project');
      return null;
    }
  }, [projects]);

  // Import project (simplified implementation)
  const importProject = useCallback(async (exportData: ProjectExport): Promise<ProjectImportResult> => {
    setError(null);
    
    try {
      // Create the project
      const importedProject = await createProject(exportData.project.name, {
        id: 'imported',
        name: exportData.project.name,
        description: exportData.project.description,
        category: 'custom',
        icon: exportData.project.icon,
        color: exportData.project.color,
        settings: exportData.project.settings,
        tags: exportData.project.metadata.tags,
      });
      
      if (!importedProject) {
        throw new Error('Failed to create imported project');
      }
      
      return {
        success: true,
        project: importedProject,
        errors: [],
        warnings: [],
        stats: {
          tasksImported: exportData.metadata.totalTasks,
          sessionsImported: exportData.metadata.totalSessions,
          settingsImported: true,
        },
      };
    } catch (e) {
      return {
        success: false,
        errors: [e instanceof Error ? e.message : 'Import failed'],
        warnings: [],
        stats: {
          tasksImported: 0,
          sessionsImported: 0,
          settingsImported: false,
        },
      };
    }
  }, [createProject]);

  // Backup project (mock implementation)
  const backupProject = useCallback(async (
    projectId: string, 
    name: string
  ): Promise<ProjectBackup | null> => {
    // This would create a backup - simplified for now
    return null;
  }, []);

  // Restore backup (mock implementation)
  const restoreBackup = useCallback(async (backupId: string): Promise<boolean> => {
    // This would restore from backup - simplified for now
    return false;
  }, []);

  // Get project stats (mock implementation)
  const getProjectStats = useCallback(async (
    projectId: string, 
    period: ProjectStats['period']
  ): Promise<ProjectStats | null> => {
    // This would calculate real stats - simplified for now
    return null;
  }, []);

  // Get templates
  const getTemplates = useCallback((): ProjectTemplate[] => {
    return PROJECT_TEMPLATES;
  }, []);

  // Create template (mock implementation)
  const createTemplate = useCallback(async (
    project: Project, 
    name: string, 
    description: string
  ): Promise<ProjectTemplate | null> => {
    // This would create a custom template - simplified for now
    return null;
  }, []);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return {
    projects,
    currentProject,
    isLoading,
    error,
    createProject,
    updateProject,
    deleteProject,
    switchProject,
    duplicateProject,
    exportProject,
    importProject,
    backupProject,
    restoreBackup,
    getProjectStats,
    getTemplates,
    createTemplate,
  };
};
