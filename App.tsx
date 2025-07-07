import React, { useState, useCallback } from "react";
import { Task, ColumnId, ColumnType } from "./types";
import { COLUMN_DEFINITIONS } from "./constants";
import ColumnComponent from "./components/Column";
import TaskModal from "./components/TaskModal";
import { useTasks } from "./hooks/useTasks";
import { useDragAndDrop } from "./hooks/useDragAndDrop";

const App: React.FC = () => {
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
  } = useTasks();

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
    <div className="min-h-screen flex flex-col p-4 bg-gray-900 text-gray-100">
      <header className="mb-6 text-center">
        <h1 className="text-4xl font-bold text-sky-400">🚀 KanFlow</h1>
        <p className="text-sm text-gray-400">
          Vibe-driven task management that just works
        </p>
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
    </div>
  );
};

export default App;
