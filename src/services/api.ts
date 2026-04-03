// Centralized API service for AI Assistant
// This consolidates API calls and provides consistent error handling

import { projectId, publicAnonKey } from '/utils/supabase/info';
import type { Document, ApiResponse, AnalyticsStats, ChatLog, ModelConfig } from '@/types';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-8b373356`;

// Token management
let authToken = '';

export const setAuthToken = (token: string) => {
    authToken = token;
};

// Common fetch options with authorization
const getHeaders = (): HeadersInit => ({
    'Authorization': `Bearer ${authToken || publicAnonKey}`,
});

const getJsonHeaders = (): HeadersInit => ({
    ...getHeaders(),
    'Content-Type': 'application/json',
});

// Error handling helper
async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
            success: false,
            error: errorData.error || `Request failed with status: ${response.status}`,
        };
    }
    const data = await response.json();
    return { success: true, data };
}

// Knowledge Base API
export const knowledgeApi = {
    list: async (): Promise<ApiResponse<{ documents: Document[] }>> => {
        const response = await fetch(`${API_BASE}/knowledge/list`, {
            headers: getHeaders(),
        });
        return handleResponse(response);
    },

    upload: async (file: File): Promise<ApiResponse<{ document: Document }>> => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE}/knowledge/upload`, {
            method: 'POST',
            headers: getHeaders(),
            body: formData,
        });
        return handleResponse(response);
    },

    addLink: async (name: string, url: string): Promise<ApiResponse<{ document: Document }>> => {
        const response = await fetch(`${API_BASE}/knowledge/add-link`, {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify({ name, url }),
        });
        return handleResponse(response);
    },

    delete: async (id: string): Promise<ApiResponse<void>> => {
        const response = await fetch(`${API_BASE}/knowledge/delete/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        return handleResponse(response);
    },

    batchDelete: async (ids: string[]): Promise<ApiResponse<{ results: Array<{ id: string; success: boolean }> }>> => {
        const response = await fetch(`${API_BASE}/knowledge/batch-delete`, {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify({ ids }),
        });
        return handleResponse(response);
    },
};

// Chat API
export const chatApi = {
    send: async (message: string, image?: string): Promise<Response> => {
        // Returns raw Response for streaming
        return fetch(`${API_BASE}/chat/send`, {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify({ message, image }),
        });
    },

    submitFeedback: async (
        messageId: string,
        type: 'like' | 'dislike',
        reason?: string
    ): Promise<ApiResponse<void>> => {
        const response = await fetch(`${API_BASE}/chat/feedback`, {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify({ messageId, type, reason }),
        });
        return handleResponse(response);
    },
};

// Analytics API
export const analyticsApi = {
    getData: async (): Promise<ApiResponse<{ stats: AnalyticsStats; logs: ChatLog[] }>> => {
        const response = await fetch(`${API_BASE}/analytics/data`, {
            headers: getHeaders(),
        });
        return handleResponse(response);
    },
};

// Health check
export const healthApi = {
    check: async (): Promise<ApiResponse<{ status: string }>> => {
        const response = await fetch(`${API_BASE}/health`, {
            headers: getHeaders(),
        });
        return handleResponse(response);
    },
};

// Auth API
export const authApi = {
    login: async (username: string, password: string): Promise<ApiResponse<{ token: string; username: string }>> => {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify({ username, password }),
        });
        return handleResponse(response);
    },

    register: async (data: { username: string; password: string; securityQuestion: string; securityAnswer: string }): Promise<ApiResponse<void>> => {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    getQuestion: async (username: string): Promise<ApiResponse<{ question: string }>> => {
        const response = await fetch(`${API_BASE}/auth/question?username=${encodeURIComponent(username)}`, {
            headers: getHeaders(),
        });
        return handleResponse(response);
    },

    resetPassword: async (data: { username: string; securityAnswer: string; newPassword: string }): Promise<ApiResponse<void>> => {
        const response = await fetch(`${API_BASE}/auth/reset-password`, {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    logout: async (): Promise<ApiResponse<void>> => {
        const response = await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            headers: getHeaders(),
        });
        return handleResponse(response);
    },

    updatePassword: async (data: { securityAnswer: string; newPassword: string }): Promise<ApiResponse<void>> => {
        const response = await fetch(`${API_BASE}/auth/update-password`, {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    updateQuestion: async (data: { password: string; newQuestion: string; newAnswer: string }): Promise<ApiResponse<void>> => {
        const response = await fetch(`${API_BASE}/auth/update-question`, {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },
    updateUsername: async (data: { password: string; newUsername: string }): Promise<ApiResponse<{ username: string }>> => {
        const response = await fetch(`${API_BASE}/auth/update-username`, {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },
    deleteAccount: async (password: string): Promise<ApiResponse<void>> => {
        const response = await fetch(`${API_BASE}/auth/delete-account`, {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify({ password }),
        });
        return handleResponse(response);
    },
    getModelConfig: async (): Promise<ApiResponse<{ config: ModelConfig | null }>> => {
        const response = await fetch(`${API_BASE}/auth/model-config`, {
            headers: getHeaders(),
        });
        return handleResponse(response);
    },
    updateModelConfig: async (data: { modelId: string; apiKey: string }): Promise<ApiResponse<{ config: ModelConfig }>> => {
        const response = await fetch(`${API_BASE}/auth/model-config`, {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },
};

// Export a unified API object
export const api = {
    knowledge: knowledgeApi,
    chat: chatApi,
    analytics: analyticsApi,
    health: healthApi,
    auth: authApi,
};

export default api;
