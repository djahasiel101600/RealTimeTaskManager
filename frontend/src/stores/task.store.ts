import { create } from 'zustand';
import type { Task, TaskStatus, Priority } from '../types';
import { taskService } from '@/services/api';

interface TaskState {
  tasks: Task[];
  selectedTask: Task | null;
  isLoading: boolean;
  filters: {
    status?: TaskStatus;
    priority?: Priority;
    assignedToMe?: boolean;
    search?: string;
  };
  
  fetchTasks: () => Promise<void>;
  fetchTask: (id: number) => Promise<void>;
  createTask: (taskData: any) => Promise<Task>;
  updateTask: (id: number, updates: Partial<Task>) => Promise<Task>;
  deleteTask: (id: number) => Promise<void>;
  updateTaskStatus: (id: number, status: TaskStatus) => Promise<void>;
  assignTask: (taskId: number, userIds: number[]) => Promise<void>;
  setFilters: (filters: Partial<TaskState['filters']>) => void;
  setSelectedTask: (task: Task | null) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  selectedTask: null,
  isLoading: false,
  filters: {},
  
  fetchTasks: async () => {
    set({ isLoading: true });
    try {
      const filters = get().filters;
      const tasks = await taskService.getTasks(filters);
      set({ tasks, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  
  fetchTask: async (id: number) => {
    set({ isLoading: true });
    try {
      const task = await taskService.getTask(id);
      set({ selectedTask: task, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  
  createTask: async (taskData: any) => {
    const task = await taskService.createTask(taskData);
    set((state) => ({ tasks: [task, ...state.tasks] }));
    return task;
  },
  
  updateTask: async (id: number, updates: Partial<Task>) => {
    const task = await taskService.updateTask(id, updates);
    set((state) => ({
      tasks: state.tasks.map(t => t.id === id ? task : t),
      selectedTask: state.selectedTask?.id === id ? task : state.selectedTask
    }));
    return task;
  },
  
  deleteTask: async (id: number) => {
    await taskService.deleteTask(id);
    set((state) => ({
      tasks: state.tasks.filter(t => t.id !== id),
      selectedTask: state.selectedTask?.id === id ? null : state.selectedTask
    }));
  },
  
  updateTaskStatus: async (id: number, status: TaskStatus) => {
    const task = await taskService.updateTaskStatus(id, status);
    set((state) => ({
      tasks: state.tasks.map(t => t.id === id ? task : t),
      selectedTask: state.selectedTask?.id === id ? task : state.selectedTask
    }));
  },
  
  assignTask: async (taskId: number, userIds: number[]) => {
    const task = await taskService.assignTask(taskId, userIds);
    set((state) => ({
      tasks: state.tasks.map(t => t.id === taskId ? task : t),
      selectedTask: state.selectedTask?.id === taskId ? task : state.selectedTask
    }));
  },
  
  setFilters: (filters) => {
    set((state) => ({ 
      filters: { ...state.filters, ...filters }
    }));
  },
  
  setSelectedTask: (task) => set({ selectedTask: task }),
}));