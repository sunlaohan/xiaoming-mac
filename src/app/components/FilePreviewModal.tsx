import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Loader2, Download, X, ExternalLink } from 'lucide-react';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: {
    name: string;
    url: string;
    type?: string;
  } | null;
}

export function FilePreviewModal({ isOpen, onClose, file }: FilePreviewModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && file) {
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      if (['txt', 'md', 'json', 'csv'].includes(extension || '')) {
        fetchTextContent(file.url);
      } else {
        setContent(null);
        setLoading(false);
        setError(null);
      }
    }
  }, [isOpen, file]);

  const fetchTextContent = async (url: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load content');
      const text = await response.text();
      setContent(text);
    } catch (err) {
      setError('无法加载文件内容，可能是跨域限制或链接失效');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!file) return null;

  const extension = file.name.split('.').pop()?.toLowerCase();
  const isOfficeDoc = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(extension || '');
  const isLink = file.type === 'link' || extension === 'link';

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-red-500 gap-4">
          <p>{error}</p>
          <Button variant="outline" onClick={() => window.open(file.url, '_blank')}>
            <Download className="h-4 w-4 mr-2" />
            下载文件查看
          </Button>
        </div>
      );
    }

    // Online Link
    if (isLink) {
      return (
        <div className="w-full h-full flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b text-sm text-gray-600">
            <span className="text-gray-500 text-xs">嵌入式网页预览</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => window.open(file.url, '_blank')}>
              <ExternalLink className="h-3 w-3 mr-1" />
              在新标签页打开
            </Button>
          </div>
          <iframe
            src={file.url}
            className="flex-1 w-full bg-white border-0"
            title="Link Preview"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>
      );
    }

    // PDF
    if (extension === 'pdf') {
      return (
        <iframe
          src={file.url}
          className="w-full h-full rounded-md border bg-gray-100"
          title="PDF Preview"
        />
      );
    }

    // Images
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '')) {
      return (
        <div className="flex items-center justify-center h-full bg-gray-100 rounded-md overflow-auto p-4">
          <img src={file.url} alt={file.name} className="max-w-full max-h-full object-contain shadow-sm" />
        </div>
      );
    }

    // Office Documents
    if (isOfficeDoc) {
      const previewUrl = `https://view.xdocin.com/view?src=${encodeURIComponent(file.url)}`;

      return (
        <div className="w-full h-full flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b text-sm text-gray-600">
            <span className="text-gray-500 text-xs">文档预览由 XDOC 提供支持</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => window.open(file.url, '_blank')}>
              <Download className="h-3 w-3 mr-1" />
              下载原文件
            </Button>
          </div>
          <iframe
            src={previewUrl}
            className="flex-1 w-full bg-white"
            title="Document Preview"
          />
        </div>
      );
    }

    // Text / Markdown
    if (content !== null) {
      return (
        <div className="w-full h-full overflow-auto p-6 bg-white rounded-md border shadow-sm">
          <pre className="font-mono text-sm whitespace-pre-wrap break-words text-gray-800">
            {content}
          </pre>
        </div>
      );
    }

    // Fallback for unsupported types
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-6 bg-gray-50 rounded-md border border-dashed border-gray-300">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900 mb-1">无法在线预览此文件</p>
          <p className="text-sm text-gray-500">文件类型: {extension?.toUpperCase() || '未知'}</p>
        </div>
        <Button onClick={() => window.open(file.url, '_blank')}>
          <Download className="h-4 w-4 mr-2" />
          下载文件
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="file-preview-dialog h-[85vh] flex flex-col p-0 gap-0 overflow-hidden [&>button]:hidden">
        <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between bg-white shrink-0">
          <div className="flex flex-col gap-1 flex-1 min-w-0 mr-4">
            <DialogTitle className="truncate text-lg font-semibold text-gray-900">
              {file.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              {file.type || extension?.toUpperCase()} • 在线预览
            </DialogDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 text-gray-500 hover:text-gray-900">
            <X className="h-5 w-5" />
            <span className="sr-only">关闭</span>
          </Button>
        </DialogHeader>
        <div className="flex-1 overflow-hidden bg-gray-50 p-4 relative flex flex-col">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
