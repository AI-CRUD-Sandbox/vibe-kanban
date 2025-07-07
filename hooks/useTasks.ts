import { useState, useEffect, useCallback } from "react";
import { Task, ColumnId } from "../types";
import { useOptimisticUpdate } from "./useOptimisticUpdate";

// Use environment variable for API base URL, fallback to current origin or localhost
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:8000");

export interface UseTasksResult {
  tasksByColumn: Record<string, Task[]>;
  isLoading: boolean;
  error: string | null;
  fetchTasks: () => Promise<void>;
  addTask: (columnId: ColumnId) => Promise<Task | null>;
  createTask: (title: string, description: string, columnId: ColumnId) => Promise<Task | null>;
  updateTask: (task: Task) => Promise<boolean>;
  deleteTask: (taskId: string) => Promise<boolean>;
  emptyColumn: (columnId: ColumnId) => Promise<boolean>;
  moveTask: (
    taskId: string,
    newColumnId: ColumnId,
    newIndex: number,
  ) => Promise<boolean>;
}

export const useTasks = (): UseTasksResult => {
  const [tasksByColumn, setTasksByColumn] = useState<Record<string, Task[]>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Record<string, Task[]> = await response.json();
      setTasksByColumn(data);
    } catch (e) {
      console.error("Failed to fetch tasks:", e);
      setError(e instanceof Error ? e.message : "An unknown error occurred");
      setTasksByColumn({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // DEPRECATED: Use createTask instead. This is kept for backward compatibility.
  const addTask = useCallback(
    async (columnId: ColumnId): Promise<Task | null> => {
      console.warn("addTask is deprecated. Use createTask instead.");
      return createTask("", "", columnId);
    },
    [],
  );

  const createTask = useCallback(
    async (title: string, description: string, columnId: ColumnId): Promise<Task | null> => {
      const newTaskPayload = {
        title: title.trim(),
        description: description.trim(),
        column_id: columnId,
      };

      try {
        const response = await fetch(`${API_BASE_URL}/api/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newTaskPayload),
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const createdTask: Task = await response.json();

        // Optimistically add the task to the UI
        setTasksByColumn((prev) => ({
          ...prev,
          [columnId]: [...(prev[columnId] || []), createdTask],
        }));

        return createdTask;
      } catch (e) {
        console.error("Failed to create task:", e);
        setError(e instanceof Error ? e.message : "Failed to create task");
        return null;
      }
    },
    [],
  );

  const performOptimisticUpdate = useOptimisticUpdate(
    () => tasksByColumn,
    setTasksByColumn,
    setError,
  );

  const updateTask = useCallback(
    async (updatedTask: Task): Promise<boolean> => {
      const { id, title, description } = updatedTask;
      const payload = { title, description };

      return performOptimisticUpdate({
        optimisticUpdate: (currentState) => {
          const updatedState = { ...currentState };
          for (const columnId in updatedState) {
            const columnTasks = updatedState[columnId] || [];
            const taskIndex = columnTasks.findIndex((t) => t.id === id);
            if (taskIndex !== -1) {
              updatedState[columnId] = [
                ...columnTasks.slice(0, taskIndex),
                updatedTask,
                ...columnTasks.slice(taskIndex + 1),
              ];
              break;
            }
          }
          return updatedState;
        },
        apiCall: async () => {
          const response = await fetch(`${API_BASE_URL}/api/tasks/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        },
      });
    },
    [performOptimisticUpdate, tasksByColumn],
  );

  const deleteTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      return performOptimisticUpdate({
        optimisticUpdate: (currentState) => {
          const updatedState = { ...currentState };
          for (const columnId in updatedState) {
            const columnTasks = updatedState[columnId] || [];
            const taskIndex = columnTasks.findIndex((t) => t.id === taskId);
            if (taskIndex !== -1) {
              updatedState[columnId] = [
                ...columnTasks.slice(0, taskIndex),
                ...columnTasks.slice(taskIndex + 1),
              ];
              break;
            }
          }
          return updatedState;
        },
        apiCall: async () => {
          const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
            method: "DELETE",
          });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response;
        },
      });
    },
    [performOptimisticUpdate, tasksByColumn],
  );

  const moveTask = useCallback(
    async (
      taskId: string,
      newColumnId: ColumnId,
      newIndex: number,
    ): Promise<boolean> => {
      return performOptimisticUpdate({
        optimisticUpdate: (currentState) => {
          const updatedState = { ...currentState };

          // Find and remove the task from its current column
          let movedTask: Task | null = null;
          for (const columnId in updatedState) {
            const columnTasks = updatedState[columnId] || [];
            const taskIndex = columnTasks.findIndex((t) => t.id === taskId);
            if (taskIndex !== -1) {
              movedTask = columnTasks[taskIndex];
              updatedState[columnId] = [
                ...columnTasks.slice(0, taskIndex),
                ...columnTasks.slice(taskIndex + 1),
              ];
              break;
            }
          }

          if (!movedTask) {
            console.error("Task not found for move operation");
            return currentState; // Return unchanged state if task not found
          }

          // Add the task to the new column at the specified index
          if (!updatedState[newColumnId]) {
            updatedState[newColumnId] = [];
          }

          const newColumnTasks = [...updatedState[newColumnId]];
          newColumnTasks.splice(newIndex, 0, movedTask);
          updatedState[newColumnId] = newColumnTasks;

          return updatedState;
        },
        apiCall: async () => {
          const response = await fetch(
            `${API_BASE_URL}/api/tasks/${taskId}/move`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                new_column_id: newColumnId,
                new_index: newIndex,
              }),
            },
          );

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        },
      });
    },
    [performOptimisticUpdate, tasksByColumn],
  );

  const emptyColumn = useCallback(
    async (columnId: ColumnId): Promise<boolean> => {
      return performOptimisticUpdate({
        optimisticUpdate: (currentState) => {
          const updatedState = { ...currentState };
          updatedState[columnId] = [];
          return updatedState;
        },
        apiCall: async () => {
          const response = await fetch(
            `${API_BASE_URL}/api/columns/${columnId}/empty`,
            {
              method: "DELETE",
            },
          );
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response;
        },
      });
    },
    [performOptimisticUpdate, tasksByColumn],
  );

  return {
    tasksByColumn,
    isLoading,
    error,
    fetchTasks,
    addTask,
    createTask,
    updateTask,
    deleteTask,
    emptyColumn,
    moveTask,
  };
};
