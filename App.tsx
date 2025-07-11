import React, { useState, useCallback } from "react";
import { Task, ColumnId, ColumnType } from "./types";
import { COLUMN_DEFINITIONS } from "./constants";
import ColumnComponent from "./components/Column";
import TaskModal from "./components/TaskModal";
import Settings from "./components/Settings";
import AIChat from "./components/AIChat";
import AISuggestions from "./components/AISuggestions";
import ErrorBoundary from "./components/ErrorBoundary";
// Temporarily disabled project management imports
// import ProjectSwitcher from "./components/ProjectSwitcher";
// import ProjectManager from "./components/ProjectManager";
import { useTasks } from "./hooks/useTasks";
import { useDragAndDrop } from "./hooks/useDragAndDrop";
import { useSettings } from "./hooks/useSettings";
import { useAI } from "./hooks/useAI";
import { logger, logUserAction } from "./utils/logger";
// import { useProjects } from "./hooks/useProjects";
// import { PROJECT_TEMPLATES } from "./types/project";

const App: React.FC = () => {
  // Project management hook - temporarily disabled to prevent infinite loops
  // TODO: Re-enable after fixing the infinite loop issue
  // const {
  //   projects,
  //   currentProject,
  //   isLoading: projectsLoading,
  //   error: projectsError,
  //   createProject,
  //   updateProject,
  //   deleteProject,
  //   switchProject,
  //   duplicateProject,
  //   exportProject,
  //   importProject,
  // } = useProjects();

  // Use custom hooks for data and drag/drop logic
  const {
    tasksByColumn,
    isLoading,
    error,
    addTask,
    createTask,
    updateTask,
    deleteTask,
    emptyColumn,
    moveTask,
  } = useTasks('default');

  // Settings hook
  const {
    settings,
    updateSettings,
    resetSettings,
    exportSettings,
    importSettings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useSettings();

  // AI Integration hook
  const {
    sessions: aiSessions,
    activeSession,
    availableServices,
    createSession: createAISession,
    switchSession: switchAISession,
    deleteSession: deleteAISession,
    sendMessage: sendAIMessage,
    streamMessage: streamAIMessage,
    getTaskSuggestions,
    getCodeSuggestions,
    applySuggestion,
    switchService: switchAIService,
    isLoading: aiLoading,
    error: aiError,
  } = useAI();

  const {
    dragState,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop,
  } = useDragAndDrop(tasksByColumn);

  // Modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskColumnId, setNewTaskColumnId] = useState<ColumnId | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isAISuggestionsOpen, setIsAISuggestionsOpen] = useState(false);
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);
  const [taskSuggestions, setTaskSuggestions] = useState<any[]>([]);
  const [codeSuggestions, setCodeSuggestions] = useState<any[]>([]);

  // Event handlers using the custom hooks
  const handleAddTask = useCallback(
    (columnId: ColumnId) => {
      // Open modal with empty task for the specified column
      setNewTaskColumnId(columnId);
      setSelectedTask({
        id: "", // Empty ID indicates this is a new task
        title: "",
        description: "",
      });
      setIsModalOpen(true);
    },
    [],
  );

  const handleSaveTask = useCallback(
    async (updatedTask: Task) => {
      let success = false;

      if (updatedTask.id === "" && newTaskColumnId) {
        // This is a new task - create it
        const createdTask = await createTask(updatedTask.title, updatedTask.description, newTaskColumnId);
        success = createdTask !== null;
      } else {
        // This is an existing task - update it
        success = await updateTask(updatedTask);
      }

      if (success) {
        setIsModalOpen(false);
        setSelectedTask(null);
        setNewTaskColumnId(null);
      }
    },
    [createTask, updateTask, newTaskColumnId],
  );

  const handleOpenModal = useCallback((task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedTask(null);
    setNewTaskColumnId(null);
  }, []);

  // AI event handlers
  const handleAIMessage = useCallback(async (message: string, context?: any) => {
    try {
      await sendAIMessage(message, context);
    } catch (error) {
      console.error('Failed to send AI message:', error);
    }
  }, [sendAIMessage]);

  const handleNewAISession = useCallback(async () => {
    try {
      if (availableServices.length > 0) {
        await createAISession(availableServices[0], 'New AI Session');
      }
    } catch (error) {
      console.error('Failed to create AI session:', error);
    }
  }, [createAISession, availableServices]);

  const handleGenerateTaskSuggestions = useCallback(async (taskId: string) => {
    try {
      const suggestions = await getTaskSuggestions(taskId);
      setTaskSuggestions(prev => [...prev, ...suggestions]);
    } catch (error) {
      console.error('Failed to generate task suggestions:', error);
    }
  }, [getTaskSuggestions]);

  const handleApplySuggestion = useCallback(async (
    suggestionId: string,
    type: 'task' | 'code'
  ): Promise<boolean> => {
    try {
      return await applySuggestion(suggestionId);
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
      return false;
    }
  }, [applySuggestion]);

  const handleRefreshSuggestions = useCallback(async () => {
    // Refresh suggestions logic would go here
    setTaskSuggestions([]);
    setCodeSuggestions([]);
  }, []);

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      const success = await deleteTask(taskId);
      if (success && selectedTask?.id === taskId) {
        handleCloseModal();
      }
    },
    [deleteTask, selectedTask, handleCloseModal],
  );

  const handleEmptyColumn = useCallback(
    async (columnId: ColumnId) => {
      await emptyColumn(columnId);
    },
    [emptyColumn],
  );

  // Project management handlers - temporarily disabled
  // TODO: Re-enable when useProjects hook is fixed
  // const handleCreateProject = useCallback(async () => {
  //   setIsProjectManagerOpen(true);
  // }, []);

  // const handleManageProjects = useCallback(async () => {
  //   setIsProjectManagerOpen(true);
  // }, []);

  // const handleSwitchProject = useCallback(async (projectId: string) => {
  //   await switchProject(projectId);
  // }, [switchProject]);

  // Drag and drop handlers
  const handleTaskDrop = useCallback(
    (event: React.DragEvent, targetColumnId: ColumnId) => {
      handleDrop(event, targetColumnId, moveTask);
    },
    [handleDrop, moveTask],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-sky-400 text-2xl">
        Loading tasks...
      </div>
    );
  }

  return (
    <ErrorBoundary onError={(error, errorInfo) => {
      logger.error('Application Error Boundary triggered', { error, errorInfo });
    }}>
      <div className="min-h-screen flex flex-col p-4 bg-gray-900 text-gray-100">
      <header className="mb-6 flex justify-between items-center">
        <div className="flex-1"></div>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-sky-400">🚀 KanFlow</h1>
          <p className="text-sm text-gray-400">
            Vibe-driven task management that just works
          </p>
        </div>
        <div className="flex-1 flex justify-end space-x-2">
          {/* AI Chat Button */}
          <button
            onClick={() => setIsAIChatOpen(true)}
            className="p-2 rounded-full text-gray-400 hover:text-sky-400 hover:bg-gray-800 transition-colors"
            title="AI Assistant"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>

          {/* AI Suggestions Button */}
          <button
            onClick={() => setIsAISuggestionsOpen(true)}
            className="p-2 rounded-full text-gray-400 hover:text-sky-400 hover:bg-gray-800 transition-colors"
            title="AI Suggestions"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-full text-gray-400 hover:text-sky-400 hover:bg-gray-800 transition-colors"
            title="Settings"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>
      {error && (
        <div className="bg-red-800 text-white p-3 rounded-md mb-4 text-center">
          {error}
        </div>
      )}
      <main
        className="flex-grow grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4"
        onDragEnd={handleDragEnd}
      >
        {COLUMN_DEFINITIONS.map((column) => (
          <ColumnComponent
            key={column.id}
            column={column}
            tasks={tasksByColumn[column.id] || []}
            onAddTask={handleAddTask}
            onOpenTaskModal={handleOpenModal}
            onEmptyColumn={handleEmptyColumn}
            onTaskDragStart={handleDragStart}
            onTaskDragOver={handleDragOver}
            onTaskDrop={handleTaskDrop}
            draggedTaskId={dragState?.draggedTaskId}
            dragOverColumn={dragState?.dragOverColumn}
            dragOverIndex={dragState?.dragOverIndex}
          />
        ))}
      </main>
      {isModalOpen && selectedTask && (
        <TaskModal
          isOpen={isModalOpen}
          task={selectedTask}
          onClose={handleCloseModal}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
        />
      )}

      <Settings
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={updateSettings}
        onReset={resetSettings}
        onExport={exportSettings}
        onImport={importSettings}
        isLoading={settingsLoading}
        error={settingsError}
      />

      <AIChat
        isOpen={isAIChatOpen}
        session={activeSession}
        availableServices={availableServices}
        currentService={availableServices[0] || 'openAI'}
        onClose={() => setIsAIChatOpen(false)}
        onSendMessage={handleAIMessage}
        onSwitchService={switchAIService}
        onNewSession={handleNewAISession}
        isLoading={aiLoading}
        error={aiError}
      />

      <AISuggestions
        isOpen={isAISuggestionsOpen}
        taskSuggestions={taskSuggestions}
        codeSuggestions={codeSuggestions}
        selectedTask={selectedTask}
        onClose={() => setIsAISuggestionsOpen(false)}
        onApplySuggestion={handleApplySuggestion}
        onGenerateSuggestions={handleGenerateTaskSuggestions}
        onRefreshSuggestions={handleRefreshSuggestions}
        isLoading={aiLoading}
        error={aiError}
      />
      </div>
    </ErrorBoundary>
  );
};

export default App;
