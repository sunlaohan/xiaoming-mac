import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { Send, Image as ImageIcon, X, Loader2, Square } from 'lucide-react';
import { toast } from 'sonner';

interface ChatInputProps {
  onSendMessage: (content: string, image?: string) => void;
  isLoading: boolean;
  onStopGeneration: () => void;
  onRecallMessage: () => { content: string; image?: string } | undefined;
}

export function ChatInput({ onSendMessage, isLoading, onStopGeneration, onRecallMessage }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('图片大小不能超过10MB');
        return;
      }

      // Check file type
      if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
        toast.error('只支持 PNG 和 JPG 格式');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        toast.success('图片已上传');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = () => {
    if ((!message.trim() && !selectedImage) || isLoading) return;

    onSendMessage(message.trim(), selectedImage || undefined);
    setMessage('');
    setSelectedImage(null);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStop = () => {
    const recalled = onRecallMessage();
    if (recalled) {
      setMessage(recalled.content);
      setSelectedImage(recalled.image || null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isLoading) {
        handleStop();
      } else {
        handleSend();
      }
    }
  };

  return (
    <div className="border-t bg-white px-6 pt-4 pb-10">
      {selectedImage && (
        <div className="mb-2 relative inline-block">
          <img
            src={selectedImage}
            alt="Preview"
            className="max-w-[200px] max-h-[200px] rounded-lg"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 hover:bg-red-600 text-white"
            onClick={() => setSelectedImage(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex gap-2 items-end max-w-full">
        <div className="flex gap-1 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className="hidden"
            onChange={handleImageUpload}
          />
          <Button
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="上传图片"
            className="h-10 w-10 p-0"
          >
            <ImageIcon className="size-5" />
          </Button>
        </div>

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={isLoading ? "AI 正在思考中..." : "输入您的问题..."}
          className="flex-1 resize-none min-h-[40px] max-h-[120px]"
          disabled={isLoading}
          rows={1}
        />

        <Button
          onClick={isLoading ? handleStop : handleSend}
          disabled={!isLoading && !message.trim() && !selectedImage}
          className="shrink-0 h-10 w-10 p-0"
          title={isLoading ? "停止生成并撤回" : "发送消息"}
        >
          {isLoading ? (
            <Square className="h-5 w-5" />
          ) : (
            <Send className="size-5" />
          )}
        </Button>
      </div>
    </div>
  );
}