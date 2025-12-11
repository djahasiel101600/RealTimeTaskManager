import { create } from 'zustand';
import type { Task, TaskStatus, Priority } from '../types';
import { taskService } from '@/services/api';

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

interface TaskState {
  tasks: Task[];
  selectedTask: Task | null;
  isLoading: boolean;
  pagination: PaginationInfo;
  filters: {
    status?: TaskStatus;
    priority?: Priority;
    assignedToMe?: boolean;
    search?: string;
  };
  
  fetchTasks: (page?: number) => Promise<void>;
  fetchTask: (id: number) => Promise<void>;
  createTask: (taskData: any) => Promise<Task>;
  updateTask: (id: number, updates: Partial<Task>) => Promise<Task>;
  deleteTask: (id: number) => Promise<void>;
  updateTaskStatus: (id: number, status: TaskStatus, reason?: string) => Promise<void>;
  assignTask: (taskId: number, userIds: number[]) => Promise<void>;
  setFilters: (filters: Partial<TaskState['filters']>) => void;
  setSelectedTask: (task: Task | null) => void;
  nextPage: () => void;
  previousPage: () => void;
  goToPage: (page: number) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  selectedTask: null,
  isLoading: false,
  pagination: {
    page: 1,
    pageSize: 20,
    totalPages: 1,
    totalCount: 0,
    hasNext: false,
    hasPrevious: false,
  },
  filters: {},
  
  fetchTasks: async (page?: number) => {
    set({ isLoading: true });
    try {
      const filters = get().filters;
      const currentPage = page ?? get().pagination.page;
      const response = await taskService.getTasks({ ...filters, page: currentPage }) as PaginatedResponse<Task> | Task[];
      
      // Handle paginated response from DRF
      if (!Array.isArray(response) && response.results) {
        const totalCount = response.count || 0;
        const pageSize = get().pagination.pageSize;
        const totalPages = Math.ceil(totalCount / pageSize);
        
        set({
          tasks: response.results,
          pagination: {
            page: currentPage,
            pageSize,
            totalCount,
            totalPages,
            hasNext: !!response.next,
            hasPrevious: !!response.previous,
          },
          isLoading: false,
        });
      } else {
        // Fallback for non-paginated response (array)
        const tasksArray = Array.isArray(response) ? response : [];
        set({ tasks: tasksArray, isLoading: false });
      }
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
  
  updateTaskStatus: async (id: number, status: TaskStatus, reason?: string) => {
    const task = await taskService.updateTaskStatus(id, status, reason);
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
      filters: { ...state.filters, ...filters },
      pagination: { ...state.pagination, page: 1 } // Reset to page 1 on filter change
    }));
  },
  
  setSelectedTask: (task) => set({ selectedTask: task }),
  
  nextPage: () => {
    const { pagination } = get();
    if (pagination.hasNext) {
      get().fetchTasks(pagination.page + 1);
    }
  },
  
  previousPage: () => {
    const { pagination } = get();
    if (pagination.hasPrevious) {
      get().fetchTasks(pagination.page - 1);
    }
  },
  
  goToPage: (page: number) => {
    const { pagination } = get();
    if (page >= 1 && page <= pagination.totalPages) {
      get().fetchTasks(page);
    }
  },
}));