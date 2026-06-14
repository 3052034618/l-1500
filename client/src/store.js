import { create } from 'zustand';

const useStore = create((set, get) => ({
  tasks: [],
  currentTask: null,
  dashboard: null,
  notifications: [],
  materials: [],
  models: [],
  loading: false,
  error: null,

  fetchTasks: async (filters = {}) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/tasks?${params}`);
      const data = await res.json();
      set({ tasks: data, loading: false });
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  fetchTask: async (id) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/tasks/${id}`);
      const data = await res.json();
      set({ currentTask: data, loading: false });
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  createTask: async (taskData) => {
    set({ loading: true });
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      const data = await res.json();
      set((state) => ({
        tasks: [data, ...state.tasks],
        loading: false
      }));
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  retryTask: async (taskId, model) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model })
      });
      const data = await res.json();
      set((state) => ({
        currentTask: data,
        tasks: state.tasks.map(t => t.id === taskId ? data : t)
      }));
      return data;
    } catch (error) {
      set({ error: error.message });
    }
  },

  approveTask: async (taskId, level, reviewer, comment = '') => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, reviewer, comment })
      });
      const data = await res.json();
      set((state) => ({
        currentTask: data,
        tasks: state.tasks.map(t => t.id === taskId ? data : t)
      }));
      return data;
    } catch (error) {
      set({ error: error.message });
    }
  },

  rejectTask: async (taskId, level, reviewer, comment = '') => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, reviewer, comment })
      });
      const data = await res.json();
      set((state) => ({
        currentTask: data,
        tasks: state.tasks.map(t => t.id === taskId ? data : t)
      }));
      return data;
    } catch (error) {
      set({ error: error.message });
    }
  },

  submitApproval: async (taskId) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/submit-approval`, {
        method: 'POST'
      });
      const data = await res.json();
      set((state) => ({
        currentTask: data,
        tasks: state.tasks.map(t => t.id === taskId ? data : t)
      }));
      return data;
    } catch (error) {
      set({ error: error.message });
    }
  },

  fetchDashboard: async () => {
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      set({ dashboard: data });
      return data;
    } catch (error) {
      set({ error: error.message });
    }
  },

  fetchNotifications: async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      set({ notifications: data });
      return data;
    } catch (error) {
      set({ error: error.message });
    }
  },

  fetchMaterials: async () => {
    try {
      const res = await fetch('/api/materials');
      const data = await res.json();
      set({ materials: data });
      return data;
    } catch (error) {
      set({ error: error.message });
    }
  },

  fetchModels: async () => {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      set({ models: data });
      return data;
    } catch (error) {
      set({ error: error.message });
    }
  },

  getRecommendations: async (materialId, materialCategory) => {
    try {
      const res = await fetch(`/api/recommendations/model?materialId=${materialId}&materialCategory=${materialCategory}`);
      return await res.json();
    } catch (error) {
      set({ error: error.message });
    }
  },

  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      return await res.json();
    } catch (error) {
      set({ error: error.message });
    }
  },

  exportData: async (taskId, format = 'json') => {
    window.open(`/api/tasks/${taskId}/export?format=${format}`, '_blank');
  },

  downloadReport: async (taskId) => {
    window.open(`/api/tasks/${taskId}/report`, '_blank');
  },

  setCurrentTask: (task) => set({ currentTask: task }),
  clearError: () => set({ error: null })
}));

export default useStore;
