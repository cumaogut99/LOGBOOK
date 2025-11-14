import axios from 'axios';
import { TestType, BrakeType, MaintenancePlan, Document } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Test Types API
export const testTypesApi = {
  getAll: async (): Promise<TestType[]> => {
    const response = await axios.get(`${API_BASE_URL}/test-types`);
    return response.data;
  },
  
  create: async (testType: Omit<TestType, 'id'>): Promise<TestType> => {
    const response = await axios.post(`${API_BASE_URL}/test-types`, testType);
    return response.data;
  },
  
  update: async (id: number, testType: Partial<TestType>): Promise<TestType> => {
    const response = await axios.put(`${API_BASE_URL}/test-types/${id}`, testType);
    return response.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/test-types/${id}`);
  }
};

// Brake Types API
export const brakeTypesApi = {
  getAll: async (): Promise<BrakeType[]> => {
    const response = await axios.get(`${API_BASE_URL}/brake-types`);
    return response.data;
  },
  
  create: async (brakeType: Omit<BrakeType, 'id'>): Promise<BrakeType> => {
    const response = await axios.post(`${API_BASE_URL}/brake-types`, brakeType);
    return response.data;
  },
  
  update: async (id: number, brakeType: Partial<BrakeType>): Promise<BrakeType> => {
    const response = await axios.put(`${API_BASE_URL}/brake-types/${id}`, brakeType);
    return response.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/brake-types/${id}`);
  }
};

// Maintenance Plans API
export const maintenancePlansApi = {
  getAll: async (): Promise<MaintenancePlan[]> => {
    const response = await axios.get(`${API_BASE_URL}/maintenance-plans`);
    return response.data;
  },
  
  getByEngineId: async (engineId: number): Promise<MaintenancePlan[]> => {
    const response = await axios.get(`${API_BASE_URL}/maintenance-plans?engineId=${engineId}`);
    return response.data;
  },
  
  create: async (plan: Omit<MaintenancePlan, 'id'>): Promise<MaintenancePlan> => {
    const response = await axios.post(`${API_BASE_URL}/maintenance-plans`, plan);
    return response.data;
  },
  
  update: async (id: number, plan: Partial<MaintenancePlan>): Promise<MaintenancePlan> => {
    const response = await axios.put(`${API_BASE_URL}/maintenance-plans/${id}`, plan);
    return response.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/maintenance-plans/${id}`);
  },
  
  approve: async (id: number, approvedBy: string): Promise<MaintenancePlan> => {
    const response = await axios.patch(`${API_BASE_URL}/maintenance-plans/${id}/approve`, { approvedBy });
    return response.data;
  },
  
  checkPeriodic: async (engineId: number): Promise<any> => {
    const response = await axios.get(`${API_BASE_URL}/maintenance-plans/check-periodic/${engineId}`);
    return response.data;
  },
  
  updateNextService: async (engineId: number): Promise<any> => {
    const response = await axios.post(`${API_BASE_URL}/maintenance-plans/update-next-service/${engineId}`);
    return response.data;
  }
};

// Enhanced Documents API with file upload support
export const documentsApi = {
  getAll: async (): Promise<Document[]> => {
    const response = await axios.get(`${API_BASE_URL}/documents`);
    return response.data;
  },
  
  getByRelated: async (relatedType: string, relatedId: number): Promise<Document[]> => {
    const response = await axios.get(`${API_BASE_URL}/documents?relatedType=${relatedType}&relatedId=${relatedId}`);
    return response.data;
  },
  
  upload: async (file: File, metadata: {
    relatedType?: 'test' | 'fault' | 'swap' | 'maintenance';
    relatedId?: number;
    uploadedBy?: string;
  }): Promise<Document> => {
    // Convert file to base64
    const fileData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    const response = await axios.post(`${API_BASE_URL}/documents/upload`, {
      fileName: file.name,
      fileData: fileData,
      fileType: file.type,
      fileSize: file.size,
      relatedType: metadata.relatedType,
      relatedId: metadata.relatedId,
      uploadedBy: metadata.uploadedBy
    });
    return response.data;
  },
  
  download: async (id: number): Promise<Blob> => {
    const response = await axios.get(`${API_BASE_URL}/documents/${id}/download`);
    const document = response.data;
    
    // Convert base64 to Blob
    const base64Data = document.fileData.split(',')[1] || document.fileData;
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: document.fileType || 'application/octet-stream' });
  },
  
  getById: async (id: number): Promise<Document> => {
    const response = await axios.get(`${API_BASE_URL}/documents/${id}`);
    return response.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/documents/${id}`);
  }
};
