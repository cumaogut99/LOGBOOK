import axios from 'axios';
import type { Engine, User, Test, Fault, SwapActivity, InventoryItem, Document, ActivityLogItem } from '../types.ts';

// In development, Vite proxy will handle /api requests
// In production, we need to use the full URL
const API_BASE_URL = import.meta.env.PROD 
  ? (import.meta.env.VITE_API_URL || '/api')
  : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// =============== USERS ===============
export const usersApi = {
  getAll: async (): Promise<User[]> => {
    const response = await api.get('/users');
    return response.data;
  },
  
  getById: async (id: number): Promise<User> => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },
  
  getByUsername: async (username: string): Promise<User | null> => {
    const response = await api.get(`/users/by-username/${username}`);
    return response.data;
  },
  
  create: async (user: Omit<User, 'id'>): Promise<User> => {
    const response = await api.post('/users', user);
    return response.data;
  },
};

// =============== ENGINES ===============
export const enginesApi = {
  getAll: async (): Promise<Engine[]> => {
    const response = await api.get('/engines');
    return response.data;
  },
  
  getById: async (id: number): Promise<Engine> => {
    const response = await api.get(`/engines/${id}`);
    return response.data;
  },
  
  getActivities: async (id: number): Promise<ActivityLogItem[]> => {
    const response = await api.get(`/engines/${id}/activities`);
    return response.data;
  },
  
  create: async (engine: Omit<Engine, 'id'>): Promise<Engine> => {
    const response = await api.post('/engines', engine);
    return response.data;
  },
  
  update: async (id: number, engine: Partial<Engine>): Promise<Engine> => {
    const response = await api.put(`/engines/${id}`, engine);
    return response.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await api.delete(`/engines/${id}`);
  },

  // Check duplicates
  checkDuplicates: async (serialNumbers: string[], excludeEngineId?: number) => {
    const response = await api.post('/check-duplicates', { serialNumbers, excludeEngineId });
    return response.data;
  },
  
  count: async (): Promise<number> => {
    const response = await api.get('/engines/count');
    return response.data.count;
  },
  
  // Build Report History
  getBuildReportHistory: async (engineId: number) => {
    const response = await api.get(`/engines/${engineId}/build-report-history`);
    return response.data;
  },
  
  saveBuildReportHistory: async (engineId: number, data: {
    uploadedBy: string;
    fileName: string;
    components: any[];
    addedCount: number;
    updatedCount: number;
    removedCount: number;
  }) => {
    const response = await api.post(`/engines/${engineId}/build-report-history`, data);
    return response.data;
  },
  
  // Life Limit Alerts
  getLifeLimitAlerts: async (engineId: number) => {
    const response = await api.get(`/engines/${engineId}/life-limit-alerts`);
    return response.data;
  },
  
  getAllLifeLimitAlerts: async () => {
    const response = await api.get('/life-limit-alerts');
    return response.data;
  },
  
  // Next Maintenance Info
  getNextMaintenance: async (engineId: number) => {
    const response = await api.get(`/engines/${engineId}/next-maintenance`);
    return response.data;
  },
};

// =============== TESTS ===============
export const testsApi = {
  getAll: async (): Promise<Test[]> => {
    const response = await api.get('/tests');
    return response.data;
  },
  
  getById: async (id: number): Promise<Test> => {
    const response = await api.get(`/tests/${id}`);
    return response.data;
  },
  
  create: async (test: Omit<Test, 'id'>): Promise<Test> => {
    const response = await api.post('/tests', test);
    return response.data;
  },
  
  update: async (id: number, test: Partial<Test>): Promise<Test> => {
    const response = await api.put(`/tests/${id}`, test);
    return response.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await api.delete(`/tests/${id}`);
  },
};

// =============== FAULTS ===============
export const faultsApi = {
  getAll: async (): Promise<Fault[]> => {
    const response = await api.get('/faults');
    return response.data;
  },
  
  getById: async (id: number): Promise<Fault> => {
    const response = await api.get(`/faults/${id}`);
    return response.data;
  },
  
  create: async (fault: Omit<Fault, 'id'>): Promise<Fault> => {
    const response = await api.post('/faults', fault);
    return response.data;
  },
  
  update: async (id: number, fault: Partial<Fault>): Promise<Fault> => {
    const response = await api.put(`/faults/${id}`, fault);
    return response.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await api.delete(`/faults/${id}`);
  },
};

// =============== SWAPS ===============
export const swapsApi = {
  getAll: async (): Promise<SwapActivity[]> => {
    const response = await api.get('/swaps');
    return response.data;
  },
  
  getById: async (id: number): Promise<SwapActivity> => {
    const response = await api.get(`/swaps/${id}`);
    return response.data;
  },
  
  create: async (swap: Omit<SwapActivity, 'id'>): Promise<SwapActivity> => {
    const response = await api.post('/swaps', swap);
    return response.data;
  },
  
  update: async (id: number, swap: Partial<SwapActivity>): Promise<SwapActivity> => {
    const response = await api.put(`/swaps/${id}`, swap);
    return response.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await api.delete(`/swaps/${id}`);
  },
};

// =============== INVENTORY ===============
export const inventoryApi = {
  getAll: async (): Promise<InventoryItem[]> => {
    const response = await api.get('/inventory');
    return response.data;
  },
  
  getById: async (id: number): Promise<InventoryItem> => {
    const response = await api.get(`/inventory/${id}`);
    return response.data;
  },
  
  create: async (item: Omit<InventoryItem, 'id'>): Promise<InventoryItem> => {
    const response = await api.post('/inventory', item);
    return response.data;
  },
  
  update: async (id: number, item: Partial<InventoryItem>): Promise<InventoryItem> => {
    const response = await api.put(`/inventory/${id}`, item);
    return response.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await api.delete(`/inventory/${id}`);
  },
};

// =============== DOCUMENTS ===============
export const documentsApi = {
  getAll: async (): Promise<Omit<Document, 'fileData'>[]> => {
    const response = await api.get('/documents');
    return response.data;
  },
  
  getById: async (id: number): Promise<Document> => {
    const response = await api.get(`/documents/${id}`);
    return response.data;
  },
  
  create: async (document: Omit<Document, 'id'>): Promise<Document> => {
    const response = await api.post('/documents', document);
    return response.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await api.delete(`/documents/${id}`);
  },
};

export default api;

