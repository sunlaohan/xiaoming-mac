// Shared type definitions for AI Assistant
// This eliminates duplicate interface definitions across components

export interface Document {
    id: string;
    name: string;
    size: number | string;
    uploadDate: string;
    type: string;
    storagePath?: string;
    signedUrl?: string;
    originalUrl?: string;
    isLink?: boolean;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    image?: string;
    timestamp: Date;
    feedback?: 'like' | 'dislike' | 'none';
    feedbackReason?: string;
}

export interface ChatLog {
    id: string;
    question: string;
    answer: string;
    timestamp: string;
    hasImage: boolean;
    feedback?: {
        type: 'like' | 'dislike';
        reason?: string;
    };
}

export interface AnalyticsStats {
    totalQuestions: number;
    totalAnswers: number;
    totalLikes: number;
    totalDislikes: number;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface ModelConfig {
    modelId: string;
    apiKey: string;
    updatedAt?: string;
}
