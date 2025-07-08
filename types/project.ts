/**
 * Project management types for Vibe Kanban application
 */
import { Task } from './index';
import { AppSettings } from './settings';
import { AISession } from './ai';

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  metadata: {
    taskCount: number;
    completedTasks: number;
    lastActivity: Date;
    totalTimeSpent?: number; // in minutes
    tags: string[];
  };
  settings: ProjectSettings;
}

export interface ProjectSettings {
  // Task management settings
  columns: {
    id: string;
    name: string;
    color: string;
    limit?: number;
    isVisible: boolean;
  }[];
  
  // AI settings specific to this project
  aiSettings: {
    enabled: boolean;
    defaultService: string;
    autoSuggestTasks: boolean;
    contextPrompt?: string;
  };
  
  // Workflow settings
  workflow: {
    autoArchiveCompleted: boolean;
    autoArchiveDays: number;
    requireTaskDescription: boolean;
    enableTimeTracking: boolean;
  };
  
  // Notification settings
  notifications: {
    enabled: boolean;
    dailyDigest: boolean;
    taskReminders: boolean;
    aiSuggestions: boolean;
  };
  
  // Integration settings
  integrations: {
    github?: {
      enabled: boolean;
      repository?: string;
      autoCreateIssues: boolean;
    };
    slack?: {
      enabled: boolean;
      webhook?: string;
      channel?: string;
    };
  };
}

export interface ProjectData {
  project: Project;
  tasks: Record<string, Task[]>; // tasks organized by column
  aiSessions: AISession[];
  backups: ProjectBackup[];
}

export interface ProjectBackup {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  createdAt: Date;
  size: number; // in bytes
  data: {
    project: Project;
    tasks: Record<string, Task[]>;
    aiSessions: AISession[];
  };
  metadata: {
    version: string;
    taskCount: number;
    sessionCount: number;
    exportedBy: string;
  };
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: 'software' | 'marketing' | 'design' | 'research' | 'personal' | 'custom';
  icon: string;
  color: string;
  settings: ProjectSettings;
  defaultTasks?: {
    columnId: string;
    title: string;
    description: string;
  }[];
  tags: string[];
}

export interface ProjectStats {
  projectId: string;
  period: 'day' | 'week' | 'month' | 'year';
  data: {
    tasksCreated: number;
    tasksCompleted: number;
    tasksInProgress: number;
    averageCompletionTime: number; // in hours
    productivityScore: number; // 0-100
    aiInteractions: number;
    timeSpent: number; // in minutes
  };
  trends: {
    tasksCreated: number[]; // daily values for the period
    tasksCompleted: number[];
    productivityScore: number[];
  };
}

export interface ProjectExport {
  version: string;
  exportedAt: Date;
  exportedBy: string;
  project: Project;
  tasks: Record<string, Task[]>;
  aiSessions: AISession[];
  settings: AppSettings;
  metadata: {
    totalTasks: number;
    totalSessions: number;
    fileSize: number;
    checksum: string;
  };
}

export interface ProjectImportResult {
  success: boolean;
  project?: Project;
  errors: string[];
  warnings: string[];
  stats: {
    tasksImported: number;
    sessionsImported: number;
    settingsImported: boolean;
  };
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  columns: [
    { id: 'ideas', name: 'Ideas', color: 'blue', isVisible: true },
    { id: 'selected', name: 'Selected', color: 'yellow', isVisible: true },
    { id: 'in_progress', name: 'In Progress', color: 'orange', limit: 3, isVisible: true },
    { id: 'parked', name: 'Parked', color: 'gray', isVisible: true },
    { id: 'done', name: 'Done', color: 'green', isVisible: true },
  ],
  aiSettings: {
    enabled: true,
    defaultService: 'openAI',
    autoSuggestTasks: true,
    contextPrompt: 'You are helping with project management tasks.',
  },
  workflow: {
    autoArchiveCompleted: false,
    autoArchiveDays: 30,
    requireTaskDescription: false,
    enableTimeTracking: false,
  },
  notifications: {
    enabled: true,
    dailyDigest: false,
    taskReminders: true,
    aiSuggestions: true,
  },
  integrations: {},
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'software-development',
    name: 'Software Development',
    description: 'Template for software development projects with standard workflow',
    category: 'software',
    icon: '💻',
    color: 'blue',
    settings: {
      ...DEFAULT_PROJECT_SETTINGS,
      columns: [
        { id: 'backlog', name: 'Backlog', color: 'gray', isVisible: true },
        { id: 'todo', name: 'To Do', color: 'blue', isVisible: true },
        { id: 'in_progress', name: 'In Progress', color: 'orange', limit: 3, isVisible: true },
        { id: 'review', name: 'Code Review', color: 'purple', isVisible: true },
        { id: 'testing', name: 'Testing', color: 'yellow', isVisible: true },
        { id: 'done', name: 'Done', color: 'green', isVisible: true },
      ],
      workflow: {
        ...DEFAULT_PROJECT_SETTINGS.workflow,
        requireTaskDescription: true,
        enableTimeTracking: true,
      },
    },
    defaultTasks: [
      { columnId: 'backlog', title: 'Set up development environment', description: 'Configure local development setup' },
      { columnId: 'backlog', title: 'Create project documentation', description: 'Write README and setup instructions' },
      { columnId: 'backlog', title: 'Implement core features', description: 'Develop main application functionality' },
    ],
    tags: ['development', 'coding', 'agile'],
  },
  {
    id: 'marketing-campaign',
    name: 'Marketing Campaign',
    description: 'Template for marketing campaigns and content creation',
    category: 'marketing',
    icon: '📢',
    color: 'pink',
    settings: {
      ...DEFAULT_PROJECT_SETTINGS,
      columns: [
        { id: 'ideas', name: 'Ideas', color: 'blue', isVisible: true },
        { id: 'planning', name: 'Planning', color: 'yellow', isVisible: true },
        { id: 'creating', name: 'Creating', color: 'orange', limit: 5, isVisible: true },
        { id: 'review', name: 'Review', color: 'purple', isVisible: true },
        { id: 'published', name: 'Published', color: 'green', isVisible: true },
      ],
    },
    defaultTasks: [
      { columnId: 'ideas', title: 'Define target audience', description: 'Research and define primary target audience' },
      { columnId: 'ideas', title: 'Create content calendar', description: 'Plan content schedule for the campaign' },
      { columnId: 'ideas', title: 'Design campaign assets', description: 'Create visual assets and copy' },
    ],
    tags: ['marketing', 'content', 'campaign'],
  },
  {
    id: 'personal-productivity',
    name: 'Personal Productivity',
    description: 'Simple template for personal task management',
    category: 'personal',
    icon: '✅',
    color: 'green',
    settings: {
      ...DEFAULT_PROJECT_SETTINGS,
      columns: [
        { id: 'inbox', name: 'Inbox', color: 'gray', isVisible: true },
        { id: 'today', name: 'Today', color: 'red', limit: 5, isVisible: true },
        { id: 'this_week', name: 'This Week', color: 'orange', isVisible: true },
        { id: 'someday', name: 'Someday', color: 'blue', isVisible: true },
        { id: 'done', name: 'Done', color: 'green', isVisible: true },
      ],
      workflow: {
        ...DEFAULT_PROJECT_SETTINGS.workflow,
        autoArchiveCompleted: true,
        autoArchiveDays: 7,
      },
    },
    defaultTasks: [
      { columnId: 'inbox', title: 'Review weekly goals', description: 'Set priorities for the week' },
      { columnId: 'inbox', title: 'Organize workspace', description: 'Clean and organize physical/digital workspace' },
    ],
    tags: ['personal', 'productivity', 'gtd'],
  },
];

export const DEFAULT_PROJECT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // yellow
  '#EF4444', // red
  '#8B5CF6', // purple
  '#F97316', // orange
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#EC4899', // pink
  '#6B7280', // gray
];

export const DEFAULT_PROJECT_ICONS = [
  '📋', '💼', '🎯', '🚀', '💡', '🔧', '📊', '🎨', '📝', '⚡',
  '🌟', '🔥', '💻', '📱', '🌐', '📈', '🎪', '🎭', '🎨', '🎵',
];

// Project management hook interface
export interface ProjectManagerHook {
  // Project state
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  
  // Project operations
  createProject: (name: string, template?: ProjectTemplate) => Promise<Project | null>;
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<boolean>;
  deleteProject: (projectId: string) => Promise<boolean>;
  switchProject: (projectId: string) => Promise<boolean>;
  duplicateProject: (projectId: string, newName: string) => Promise<Project | null>;
  
  // Data operations
  exportProject: (projectId: string) => Promise<ProjectExport | null>;
  importProject: (exportData: ProjectExport) => Promise<ProjectImportResult>;
  backupProject: (projectId: string, name: string) => Promise<ProjectBackup | null>;
  restoreBackup: (backupId: string) => Promise<boolean>;
  
  // Statistics
  getProjectStats: (projectId: string, period: ProjectStats['period']) => Promise<ProjectStats | null>;
  
  // Templates
  getTemplates: () => ProjectTemplate[];
  createTemplate: (project: Project, name: string, description: string) => Promise<ProjectTemplate | null>;
}
