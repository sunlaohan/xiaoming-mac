import React, { useMemo, useState, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { Bot, User, FileText, Link as LinkIcon, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import botAvatar from '@/assets/logo2.png';
import { toast } from 'sonner';
import { api } from '@/services/api';

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

interface ChatMessageProps {
  message: Message;
  documents?: Document[];
  onPreviewDocument?: (doc: Document) => void;
}

function ChatMessageComponent({ message, documents, onPreviewDocument }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [feedback, setFeedback] = useState<'like' | 'dislike' | 'none'>(message.feedback || 'none');
  const [showDislikeInput, setShowDislikeInput] = useState(false);
  const [dislikeReason, setDislikeReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Find referenced documents in the message content
  const referencedDocs = useMemo(() => {
    if (isUser || !documents || documents.length === 0) return [];

    // Sort by name length desc to match longest names first if we were doing replacement,
    // but here we just need to check existence.
    // We check if the document name is present in the content
    return documents.filter(doc => doc.name && message.content.includes(doc.name));
  }, [message.content, documents, isUser]);

  const getDocIcon = (type: string) => {
    if (type === 'link') return <LinkIcon className="h-3 w-3" />;
    return <FileText className="h-3 w-3" />;
  };

  const handleFeedback = async (type: 'like' | 'dislike') => {
    if (isSubmitting) return;

    // If clicking same button, do nothing or maybe toggle off? 
    // Usually you just stay selected.
    if (feedback === type) return;

    if (type === 'dislike') {
      setShowDislikeInput(true);
      return;
    }

    // Handle Like immediately
    await submitFeedback(type);
  };

  const submitFeedback = async (type: 'like' | 'dislike', reason?: string) => {
    setIsSubmitting(true);
    try {
      const res = await api.chat.submitFeedback(message.id, type, reason);

      if (!res.success) {
        throw new Error(res.error || 'Failed to submit feedback');
      }

      setFeedback(type);
      setShowDislikeInput(false);
      // Don't clear reason in case they want to edit? 
      // Actually usually once submitted it's done. 
      // But we persist local state.

      if (type === 'like') {
        toast.success('感谢您的反馈！');
      } else {
        toast.success('反馈已提交，我们会努力改进');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('反馈提交失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDislikeSubmit = () => {
    submitFeedback('dislike', dislikeReason);
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-4`}>
      <Avatar className="h-8 w-8 shrink-0">
        {!isUser && <AvatarImage src={botAvatar} alt="AI" />}
        <AvatarFallback className={isUser ? 'bg-primary' : 'bg-gray-500'}>
          {isUser ? <User className="h-4 w-4 text-primary-foreground" /> : <Bot className="h-4 w-4 text-white" />}
        </AvatarFallback>
      </Avatar>

      <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-lg px-4 py-3 ${isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-gray-100 text-black'
            }`}
        >
          <div className="text-sm markdown-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ node, ...props }) => (
                  <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 hover:underline break-all"
                    onClick={(e) => e.stopPropagation()}
                  />
                ),
                p: ({ node, ...props }) => <p {...props} className="mb-2 last:mb-0 leading-relaxed whitespace-pre-wrap" />,
                ul: ({ node, ...props }) => <ul {...props} className="list-disc list-inside mb-2 ml-1" />,
                ol: ({ node, ...props }) => <ol {...props} className="list-decimal list-inside mb-2 ml-1" />,
                li: ({ node, ...props }) => <li {...props} className="mb-1" />,
                code: ({ node, className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const isInline = !match;
                  return (
                    <code
                      className={`${className} ${isInline ? 'bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 font-mono text-xs' : 'block bg-gray-800 text-white p-2 rounded-md overflow-x-auto my-2'}`}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                pre: ({ node, ...props }) => <pre {...props} className="m-0" />
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>

          {message.image && (
            <img
              src={message.image}
              alt="Uploaded"
              className="mt-2 rounded-md max-w-full h-auto"
            />
          )}

          {/* Referenced Documents Cards */}
          {/* Only show documents if there are a few of them (<= 3). 
              If there are too many, it's likely a list/enumeration in the text rather than a specific reference,
              so we hide them to avoid cluttering the UI as per user request. */}
          {!isUser && referencedDocs.length > 0 && referencedDocs.length <= 3 && (
            <div className="mt-4 pt-3 border-t border-gray-200/60 flex flex-wrap gap-2">
              <span className="text-sm text-gray-500 w-full mb-1">相关文档：</span>
              {referencedDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => onPreviewDocument && onPreviewDocument(doc)}
                  className="flex items-center gap-2 bg-white px-3 py-2 rounded-md border border-gray-200 shadow-sm hover:bg-gray-50 cursor-pointer transition-colors max-w-full"
                >
                  <div className="shrink-0 text-blue-500">
                    {getDocIcon(doc.type)}
                  </div>
                  <span className="text-sm font-medium text-gray-700 truncate max-w-[180px]">
                    {doc.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Feedback Controls - Only for AI messages, excluding the welcome message (id: '1') */}
        {!isUser && message.id !== '1' && (
          <div className="mt-1 flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span>{message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <div className="flex items-center gap-2 ml-2">
              <button
                onClick={() => handleFeedback('like')}
                className={`p-1 rounded hover:bg-gray-100 transition-colors ${feedback === 'like' ? 'text-primary' : 'text-gray-400'}`}
                title="赞同"
              >
                <ThumbsUp className={`h-3.5 w-3.5 ${feedback === 'like' ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={() => handleFeedback('dislike')}
                className={`p-1 rounded hover:bg-gray-100 transition-colors ${feedback === 'dislike' ? 'text-red-500' : 'text-gray-400'}`}
                title="不赞同"
              >
                <ThumbsDown className={`h-3.5 w-3.5 ${feedback === 'dislike' ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>
        )}

        {/* User timestamp */}
        {isUser && (
          <span className="text-xs text-gray-400 mt-1 px-1">
            {message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}

        {/* Dislike Reason Input */}
        {showDislikeInput && !isUser && (
          <div className="mt-2 w-full max-w-sm bg-white p-3 rounded-lg border shadow-sm animate-in fade-in slide-in-from-top-1">
            <p className="text-xs font-medium text-gray-700 mb-2">请告诉我们不赞同的原因（可选）：</p>
            <Textarea
              value={dislikeReason}
              onChange={(e) => setDislikeReason(e.target.value)}
              placeholder="回答不准确？理解有误？"
              className="min-h-[60px] text-xs px-3 py-2 resize-none mb-2"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDislikeInput(false)}
                className="h-7 text-xs px-2"
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleDislikeSubmit}
                disabled={isSubmitting}
                className="h-7 text-xs px-3"
              >
                {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : '提交'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Memoize the component to prevent re-renders when parent updates
// Only re-render when message.id, message.content, message.feedback, or documents change
export const ChatMessage = memo(ChatMessageComponent, (prevProps, nextProps) => {
  // Return true if props are equal (should NOT re-render)
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.feedback === nextProps.message.feedback &&
    prevProps.message.feedbackReason === nextProps.message.feedbackReason &&
    prevProps.documents === nextProps.documents
  );
});