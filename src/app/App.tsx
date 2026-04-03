import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '@/app/components/ChatMessage';
import { ChatInput } from '@/app/components/ChatInput';
import { KnowledgeBase } from '@/app/components/KnowledgeBase';
import { TypingIndicator } from '@/app/components/TypingIndicator';
import { FilePreviewModal } from '@/app/components/FilePreviewModal';
import { Button } from '@/app/components/ui/button';
import { Toaster } from '@/app/components/ui/sonner';
import { Settings, Zap, Menu, Database, Book } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import logoImage from "@/assets/logo2.png";
import { AuthModal } from '@/app/components/AuthModal';
import { UserProfileModal } from '@/app/components/UserProfileModal';
import { ServiceAnalyticsModal } from '@/app/components/ServiceAnalyticsModal';
import { api, setAuthToken } from '@/services/api';
import { LogOut, User as UserIcon, PieChart } from 'lucide-react';
import type { ModelConfig } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';

interface Document {
  id: string;
  name: string;
  size: number | string;
  uploadDate: string;
  type: string;
  storagePath?: string;
  signedUrl?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp: Date;
  feedback?: 'like' | 'dislike' | 'none';
  feedbackReason?: string;
}

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-8b373356`;
const MISSING_MODEL_CONFIG_MESSAGE = '请先通过账号设置配置模型信息哦～～';

const openModelConfigPrompt = (
  setModelConfig: React.Dispatch<React.SetStateAction<ModelConfig | null>>,
  setShowModelConfigModal: React.Dispatch<React.SetStateAction<boolean>>,
) => {
  setModelConfig(null);
  setShowModelConfigModal(true);
  toast.info('请先完成模型配置');
};

// Storage key helper
const getStorageKey = (username: string) => `chat-messages-${username}`;

const migrateStoredMessages = (oldUsername: string, newUsername: string) => {
  if (!oldUsername || !newUsername || oldUsername === newUsername) return;

  const oldKey = getStorageKey(oldUsername);
  const newKey = getStorageKey(newUsername);
  const existing = localStorage.getItem(oldKey);

  if (existing && !localStorage.getItem(newKey)) {
    localStorage.setItem(newKey, existing);
  }

  localStorage.removeItem(oldKey);
};

// Default welcome message
const getWelcomeMessage = (): Message => ({
  id: '1',
  role: 'assistant',
  content: '你好，我是小鸣同学，可以帮你解决各种问题。你也可以通过知识库录入我需要了解的信息，这样我可以更好地为你提供服务。',
  timestamp: new Date()
});

// Load messages from localStorage
const loadStoredMessages = (username: string): Message[] => {
  if (!username) return [getWelcomeMessage()];
  try {
    const stored = localStorage.getItem(getStorageKey(username));
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert timestamp strings back to Date objects
      return parsed.map((msg: Message) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    }
  } catch (e) {
    console.error('Failed to load stored messages:', e);
  }
  return [getWelcomeMessage()];
};

// Save messages to localStorage
const saveMessages = (username: string, messages: Message[]) => {
  if (!username) return;
  try {
    // Keep only last 50 messages to avoid localStorage size limits
    const messagesToSave = messages.slice(-50);
    localStorage.setItem(getStorageKey(username), JSON.stringify(messagesToSave));
  } catch (e) {
    console.error('Failed to save messages:', e);
  }
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([getWelcomeMessage()]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auth state
  const [token, setToken] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);
  const [showModelConfigModal, setShowModelConfigModal] = useState(false);
  const [isSavingModelConfig, setIsSavingModelConfig] = useState(false);
  const [modelIdInput, setModelIdInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');

  // Document state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_username');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUsername(storedUser);
      setAuthToken(storedToken);
      loadDocuments();
      void loadModelConfig();
    } else {
      setShowAuthModal(true);
    }
  }, []);

  // Load messages when username changes
  useEffect(() => {
    if (username) {
      setMessages(loadStoredMessages(username));
    } else {
      setMessages([getWelcomeMessage()]);
    }
  }, [username]);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (username && messages.length > 0) {
      saveMessages(username, messages);
    }
  }, [messages, username]);

  const handleLoginSuccess = (newToken: string, newUsername: string) => {
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_username', newUsername);
    setToken(newToken);
    setUsername(newUsername);
    setAuthToken(newToken);
    setShowAuthModal(false);
    loadDocuments();
    void loadModelConfig();
  };

  const handleUsernameUpdated = (newUsername: string) => {
    const previousUsername = username;
    localStorage.setItem('auth_username', newUsername);
    migrateStoredMessages(previousUsername, newUsername);
    setUsername(newUsername);
    setMessages(loadStoredMessages(newUsername));
    toast.success(`当前账号已更新为 ${newUsername}`);
  };

  const handleLogout = () => {
    api.auth.logout(); // Fire and forget
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_username');
    setToken('');
    setUsername('');
    setAuthToken('');
    setDocuments([]);
    setModelConfig(null);
    setShowModelConfigModal(false);
    setModelIdInput('');
    setApiKeyInput('');
    setIsProfileOpen(false); // Close profile if open
    setShowAuthModal(true);
    toast.success('已退出登录');
  };

  const loadModelConfig = async () => {
    try {
      const res = await api.auth.getModelConfig();
      if (res.success) {
        const config = res.data?.config ?? null;
        setModelConfig(config);
        setModelIdInput(config?.modelId ?? '');
        setApiKeyInput(config?.apiKey ?? '');
        setShowModelConfigModal(!config);
      } else if (res.error?.includes('Unauthorized')) {
        setModelConfig(null);
      } else {
        toast.error(res.error || '加载模型配置失败');
      }
    } catch (error) {
      console.error('Failed to load model config:', error);
      toast.error('加载模型配置失败');
    }
  };

  const handleSaveModelConfig = async () => {
    if (!modelIdInput.trim() || !apiKeyInput.trim()) {
      toast.error('请填写模型ID和API Key');
      return;
    }

    setIsSavingModelConfig(true);
    try {
      const res = await api.auth.updateModelConfig({
        modelId: modelIdInput.trim(),
        apiKey: apiKeyInput.trim(),
      });

      if (res.success && res.data?.config) {
        setModelConfig(res.data.config);
        setShowModelConfigModal(false);
        toast.success('模型配置已保存');
      } else {
        toast.error(res.error || '模型配置保存失败');
      }
    } catch (error) {
      console.error('Failed to save model config:', error);
      toast.error('模型配置保存失败');
    } finally {
      setIsSavingModelConfig(false);
    }
  };

  const loadDocuments = async (retryCount = 0) => {
    try {
      console.log('Loading documents from:', `${API_BASE}/knowledge/list`);

      // Add timeout control
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const res = await api.knowledge.list();

        if (res.success && res.data?.documents) {
          setDocuments(res.data.documents);
        } else {
          // If 401, it might mean token expired, but let's just empty the list for now
          // and maybe toast if it's a real error
          if (!res.success && res.error) {
            console.error('List docs error:', res.error);
            // Don't throw here to avoid retry loop for auth errors
            if (res.error.includes('Unauthorized')) {
              return; // Stop retrying if unauthorized
            }
            throw new Error(res.error);
          }
          setDocuments([]);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error(`Error loading documents (attempt ${retryCount + 1}):`, error);

      // Retry up to 3 times with exponential backoff
      if (retryCount < 3) {
        const delay = 1000 * Math.pow(2, retryCount);
        console.log(`Retrying in ${delay}ms...`);
        setTimeout(() => loadDocuments(retryCount + 1), delay);
      } else {
        // Only toast on final failure
        toast.error('无法加载知识库文档,请检查网络连接');
      }
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handlePreviewDocument = (doc: Document) => {
    if (doc.type === 'link' || (doc.name && doc.name.endsWith('.url'))) {
      window.open(doc.signedUrl, '_blank');
    } else {
      setPreviewDoc(doc);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setIsStreaming(false);
    toast.info('已停止生成');
  };

  const handleRecallMessage = () => {
    // Find the last user message
    const lastUserMessageIndex = messages.findLastIndex(msg => msg.role === 'user');
    if (lastUserMessageIndex === -1) return;

    const lastUserMessage = messages[lastUserMessageIndex];

    // Stop any ongoing generation
    handleStopGeneration();

    // Remove the last user message and any AI responses after it
    setMessages(prev => prev.slice(0, lastUserMessageIndex));

    // Return the message content for editing
    return {
      content: lastUserMessage.content === '发送了一张图片' ? '' : lastUserMessage.content,
      image: lastUserMessage.image
    };
  };

  const handleSendMessage = async (content: string, image?: string) => {
    if (!content && !image) return;

    // Add user message with unique UUID
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content || '发送了一张图片',
      image,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Call backend API with timeout control
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for AI response

      try {
        const response = await fetch(`${API_BASE}/chat/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: content,
            image: image,
          }),
          signal: controller.signal,
        });

        console.log('API response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API error response:', errorText);
          throw new Error(`Failed to get AI response: ${response.status}`);
        }

        // Handle Streaming Response
        if (response.headers.get('content-type')?.includes('text/event-stream')) {
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) throw new Error('No response body');

          // Create initial empty AI message with unique UUID
          const aiMessageId = crypto.randomUUID();
          const aiMessage: Message = {
            id: aiMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date()
          };

          // Start streaming state immediately
          setIsLoading(false);
          setIsStreaming(true);
          setMessages(prev => [...prev, aiMessage]);
          let accumulatedContent = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const dataStr = line.slice(6);
                    if (dataStr.trim() === '[DONE]') continue;

                    const data = JSON.parse(dataStr);

                    if (data.content) {
                      accumulatedContent += data.content;
                      setMessages(prev => prev.map(msg =>
                        msg.id === aiMessageId
                          ? { ...msg, content: accumulatedContent }
                          : msg
                      ));
                    }

                    if (data.done && data.id) {
                      // Update message ID with the one from server
                      setMessages(prev => prev.map(msg =>
                        msg.id === aiMessageId
                          ? { ...msg, id: data.id } // Use server ID
                          : msg
                      ));
                    }

                    if (data.modelConfigRequired) {
                      openModelConfigPrompt(setModelConfig, setShowModelConfigModal);
                    } else if (data.error) {
                      toast.error('AI生成过程中出错: ' + data.error);
                    }
                  } catch (e) {
                    // Ignore partial JSON parse errors
                  }
                }
              }
            }
          } catch (streamError) {
            console.error('Stream reading error:', streamError);
            // If we got some content, keep it, otherwise show error
            if (!accumulatedContent) {
              throw streamError;
            } else {
              toast.warning('AI响应可能不完整,建议重试');
            }
          } finally {
            setIsStreaming(false);
          }

        } else {
          // Handle standard JSON response (fallback)
          const data = await response.json();
          console.log('API response data:', data);

          const aiResponse: Message = {
            id: data.id || crypto.randomUUID(),
            role: 'assistant',
            content: data.response || '抱歉,我暂时无法回答这个问题。',
            timestamp: new Date()
          };

          setMessages(prev => [...prev, aiResponse]);

          if (data.response === MISSING_MODEL_CONFIG_MESSAGE) {
            openModelConfigPrompt(setModelConfig, setShowModelConfigModal);
          } else if (data.fallback) {
            toast.info('AI 服务暂时不可用，使用演示模式回复');
          } else if (data.error) {
            toast.warning('AI 响应可能不准确', {
              description: data.error
            });
          }
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Error sending message:', error);

      // Don't show error if user manually aborted
      if (error instanceof Error && error.name === 'AbortError') {
        // User stopped generation, don't add error message
        return;
      }

      // Add error message
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '抱歉，服务暂时不可用。请稍后再试。\n\n提示：请检查浏览器控制台查看详细错误信息。',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);

      // Better error message for timeout
      const errorMsg = error instanceof Error ? error.message : '未知错误';

      toast.error('发送失败,请重试', {
        description: errorMsg
      });
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50">
      <Toaster position="top-center" duration={2000} />

      {/* Header */}
      <header className="bg-white border-b px-4 py-3 pt-10 shadow-sm app-region-drag">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Logo" className="h-9 w-9 rounded-xl" />
            <div>
              <h1 className="font-semibold text-lg">小鸣同学</h1>
              <p className="text-xs text-gray-500">智能伙伴 v1.0</p>
            </div>
          </div>

          <div className="flex items-center gap-2 app-region-no-drag">


            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              {username && (
                <div className="hidden md:flex items-center text-sm text-gray-600 mr-2">
                  <UserIcon className="h-4 w-4 mr-1" />
                  {username}
                </div>
              )}

              {/* Desktop Knowledge Base Button - Book Icon */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsKnowledgeBaseOpen(true)}
                className="hidden sm:flex items-center gap-2"
                title="知识库管理"
              >
                <Book className="h-5 w-5" />
              </Button>

              <Button variant="ghost" size="icon" onClick={() => setIsAnalyticsOpen(true)} title="服务分析">
                <PieChart className="h-5 w-5" />
              </Button>

              {token && (
                <>
                  <Button variant="ghost" size="icon" onClick={() => setIsProfileOpen(true)} title="个人中心">
                    <Settings className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleLogout} title="退出登录">
                    <LogOut className="h-5 w-5" />
                  </Button>
                </>
              )}
            </div>
            <ServiceAnalyticsModal isOpen={isAnalyticsOpen} onClose={() => setIsAnalyticsOpen(false)} />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <div className="h-full overflow-y-auto p-4 pb-20 scroll-smooth" id="chat-container">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-500">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">欢迎使用小鸣同学</h2>
              <p className="max-w-md">
                我可以帮您解答关于系统操作、设备维护等问题。请在下方输入您的问题。
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                documents={documents}
                onPreviewDocument={setPreviewDoc}
              />
            ))
          )}
          {isLoading && (
            <div className="mb-4">
              <TypingIndicator />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <ChatInput
        onSendMessage={handleSendMessage}
        isLoading={isStreaming || isLoading}
        onStopGeneration={handleStopGeneration}
        onRecallMessage={handleRecallMessage}
      />

      <KnowledgeBase
        isOpen={isKnowledgeBaseOpen}
        onClose={() => setIsKnowledgeBaseOpen(false)}
        documents={documents}
        onRefresh={loadDocuments}
      />

      <FilePreviewModal
        document={previewDoc}
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      <AuthModal
        isOpen={showAuthModal}
        onLoginSuccess={handleLoginSuccess}
      />

      <Dialog
        open={showModelConfigModal}
        onOpenChange={(open) => {
          if (modelConfig) {
            setShowModelConfigModal(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px] [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">模型信息配置</DialogTitle>
            <DialogDescription className="text-center">
              首次使用请先完成模型 ID 和 API Key 配置
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="model-id">模型ID</Label>
              <Input
                id="model-id"
                value={modelIdInput}
                onChange={(e) => setModelIdInput(e.target.value)}
                placeholder="请输入模型ID"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model-api-key">API Key</Label>
              <Input
                id="model-api-key"
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="请输入API Key"
              />
            </div>

            <Button className="w-full" onClick={handleSaveModelConfig} disabled={isSavingModelConfig}>
              {isSavingModelConfig ? '保存中...' : '保存模型配置'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        username={username}
        onLogout={handleLogout}
        modelConfig={modelConfig}
        onUsernameUpdated={handleUsernameUpdated}
        onModelConfigUpdated={(config) => {
          setModelConfig(config);
          setModelIdInput(config.modelId);
          setApiKeyInput(config.apiKey);
          setShowModelConfigModal(false);
        }}
      />

    </div>
  );
}
