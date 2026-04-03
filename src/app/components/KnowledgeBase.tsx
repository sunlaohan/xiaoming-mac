import React, { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/app/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Upload, Trash2, Eye, FileText, Lock, Loader2, X, Link as LinkIcon, ExternalLink, FilePenLine } from 'lucide-react';
import { Label } from '@/app/components/ui/label';
import { toast } from 'sonner';

import { FilePreviewModal } from '@/app/components/FilePreviewModal';
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



interface KnowledgeBaseProps {
  isOpen: boolean;
  onClose: () => void;
  documents: Document[];
  onRefresh: () => Promise<void>;
}

const PASSWORD = '1688';
// const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-8b373356`; // Removed unused constant

export function KnowledgeBase({ isOpen, onClose, documents, onRefresh }: KnowledgeBaseProps) {
  // const [isAuthenticated, setIsAuthenticated] = useState(false); // Removed legacy auth
  // const [password, setPassword] = useState(''); // Removed legacy auth
  // const [attemptCount, setAttemptCount] = useState(0); // Removed legacy auth
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [activeTab, setActiveTab] = useState('knowledge');

  // Create document state
  const [isCreateDocOpen, setIsCreateDocOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [editingDocId, setEditingDocId] = useState<string | null>(null);



  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'knowledge') {
        const fetchDocs = async () => {
          setIsLoading(true);
          try {
            await onRefresh();
          } finally {
            setIsLoading(false);
          }
        };
        fetchDocs();
        fetchDocs();
      }
    }
  }, [isOpen]);



  // handlePasswordSubmit removed

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    for (const file of Array.from(files)) {
      try {
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name} 文件大小不能超过50MB`);
          continue;
        }

        const allowedTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/markdown',
          'text/plain'
        ];

        if (!allowedTypes.includes(file.type) && !file.name.endsWith('.md')) {
          toast.error(`${file.name} 格式不支持，请上传 PDF、DOC、DOCX、MD 或 TXT 文件`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        console.log(`Uploading file: ${file.name}, size: ${file.size}, type: ${file.type}`);

        const res = await api.knowledge.upload(file);

        if (res.success) {
          console.log(`Upload successful:`, res.data);
          toast.success(`${file.name} 上传成功`);
        } else {
          throw new Error(res.error || 'Upload failed');
        }

      } catch (error) {
        console.error('Error uploading file:', error);
        toast.error(`${file.name} 上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    setIsUploading(false);

    console.log('All uploads completed, reloading document list...');
    await onRefresh();

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!linkName.trim() || !linkUrl.trim()) {
      toast.error('请输入链接名称和地址');
      return;
    }

    setIsUploading(true);

    try {
      // 1. 尝试抓取网页内容 (Client-side scraping)
      let content = `URL: ${linkUrl}\n\n`;
      try {
        const res = await fetch(linkUrl, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          }
        });

        if (res.ok) {
          const html = await res.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          // 移除不需要的标签
          const scripts = doc.querySelectorAll('script, style, link, meta, noscript, svg, iframe, header, footer, nav');
          scripts.forEach(script => script.remove());

          // 提取文本
          const text = doc.body.innerText || doc.body.textContent || '';

          // 简单的清理
          const cleanText = text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n\n');

          content += cleanText;
          toast.success('网页内容抓取成功');
        } else {
          content += `(网页内容抓取失败: ${res.status} ${res.statusText})`;
          toast.warning('无法抓取网页内容，仅保存链接');
        }
      } catch (err) {
        console.error('Scraping error:', err);
        content += `(网页内容抓取失败: ${err instanceof Error ? err.message : '未知错误'})`;
        toast.warning('无法抓取网页内容，仅保存链接');
      }

      // 2. 作为Markdown文件上传
      // 构造文件名，确保是.md结尾
      // 使用 id 作为文件名的一部分以避免冲突，或者直接使用 linkName
      // 后端 upload 逻辑会生成唯一 ID，这里只要 type 是 markdown 即可
      const fileName = `${linkName.trim()}.md`;
      const blob = new Blob([`# ${linkName}\n\n${content}`], { type: 'text/markdown' });
      const file = new File([blob], fileName, { type: 'text/markdown' });

      const formData = new FormData();
      formData.append('file', file);

      const res = await api.knowledge.upload(file);

      if (!res.success) {
        throw new Error(res.error || 'Failed to upload link content');
      }

      // Removed response.ok check as we used api wrapper


      toast.success('链接内容已保存到知识库');
      setLinkName('');
      setLinkUrl('');
      setIsAddLinkOpen(false);
      await onRefresh();
    } catch (error) {
      console.error('Error adding link:', error);
      toast.error('添加链接失败');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveDocument = async () => {
    // Validate inputs
    if (!docTitle.trim()) {
      toast.error('请输入文档标题');
      return;
    }

    if (!docContent.trim()) {
      toast.error('请输入文档内容');
      return;
    }

    setIsUploading(true);

    try {
      if (editingDocId) {
        await api.knowledge.delete(editingDocId);
      }

      // Create markdown file
      const fileName = docTitle.trim().endsWith('.md') ? docTitle.trim() : `${docTitle.trim()}.md`;
      const blob = new Blob([docContent], { type: 'text/markdown' });
      const file = new File([blob], fileName, { type: 'text/markdown' });

      // Upload file
      const res = await api.knowledge.upload(file);

      if (!res.success) {
        throw new Error(res.error || 'Failed to upload document');
      }

      // Removed response.ok check

      toast.success(editingDocId ? '文档更新成功' : '文档创建成功');

      // Reset form and close dialog
      setDocTitle('');
      setDocContent('');
      setEditingDocId(null);
      setIsCreateDocOpen(false);

      // Refresh document list
      await onRefresh();
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error(editingDocId ? '更新文档失败' : '创建文档失败');
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditDocument = async (doc: Document) => {
    // Only allow editing MD files
    if (doc.type.toLowerCase() !== 'md') {
      handlePreview(doc);
      return;
    }

    setIsUploading(true);
    setOpeningDocId(doc.id);

    try {
      // For fetch(signedUrl), we just fetch it directly as it is a signed URL
      const response = await fetch(doc.signedUrl || '');

      if (!response.ok) {
        throw new Error('Failed to load document');
      }

      const content = await response.text();

      // Set editing state
      setEditingDocId(doc.id);
      setDocTitle(doc.name.replace(/\.md$/i, ''));
      setDocContent(content);
      setIsCreateDocOpen(true);
    } catch (error) {
      console.error('Error loading document:', error);
      toast.error('加载文档失败');
    } finally {
      setIsUploading(false);
      setOpeningDocId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setIsUploading(true);
      setDeletingDocId(id);

      const res = await api.knowledge.delete(id);

      if (!res.success) {
        throw new Error(res.error || `Delete failed`);
      }

      await onRefresh();
      setSelectedDocs(prev => prev.filter(docId => docId !== id));
      toast.success('文档已删除');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('删除失败');
    } finally {
      setIsUploading(false);
      setDeletingDocId(null);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedDocs.length === 0) {
      toast.error('请先选择要删除的文档');
      return;
    }

    setIsUploading(true);

    try {
      const res = await api.knowledge.batchDelete(selectedDocs);

      if (!res.success) {
        throw new Error(res.error || 'Batch delete failed');
      }

      await onRefresh();
      const count = selectedDocs.length;
      setSelectedDocs([]);
      toast.success(`已删除 ${count} 个文档`);
    } catch (error) {
      console.error('Error batch deleting documents:', error);
      toast.error('批量删除失败');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedDocs.length === documents.length) {
      setSelectedDocs([]);
    } else {
      setSelectedDocs(documents.map(doc => doc.id));
    }
  };

  const handlePreview = (doc: Document) => {
    if (doc.type === 'link') {
      window.open(doc.signedUrl, '_blank');
      return;
    }

    if (doc.signedUrl) {
      setPreviewDoc(doc);
    } else {
      toast.error('文档预览链接不可用');
      console.error('Document missing signedUrl:', doc);
    }
  };

  // Lock screen dialog removed

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="knowledge-base-dialog h-[90vh] max-h-[90vh] overflow-hidden flex flex-col [&>button]:hidden app-region-no-drag">
        <DialogHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="flex flex-col gap-1">
            <DialogTitle className="flex items-center gap-2">
              知识库管理
            </DialogTitle>
            <DialogDescription>
              你可以通过创建文档定制属于你的独家记忆～
            </DialogDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 text-gray-500 hover:text-gray-900 app-region-no-drag">
            <X className="h-5 w-5" />
            <span className="sr-only">关闭</span>
          </Button>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-1 hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="knowledge">知识库</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="knowledge" className="flex-1 flex flex-col overflow-hidden mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.md,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />

            <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 mb-4 shrink-0">
              <Button
                onClick={() => setIsCreateDocOpen(true)}
                disabled={isUploading}
                className="w-full sm:w-auto"
              >
                <FileText className="h-4 w-4 mr-2" />
                创建文档
              </Button>

              <Button
                variant="outline"
                onClick={() => setIsAddLinkOpen(true)}
                disabled={isUploading}
                className="w-full sm:w-auto"
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                添加链接
              </Button>
              <Button
                variant="destructive"
                onClick={handleBatchDelete}
                disabled={selectedDocs.length === 0 || isUploading}
                className="col-span-2 sm:col-span-1 w-full sm:w-auto"
              >
                {isUploading && selectedDocs.length > 0 && !openingDocId && !deletingDocId ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                批量删除 {selectedDocs.length > 0 && `(${selectedDocs.length})`}
              </Button>
            </div>



            {/* Add Link Dialog */}
            <Dialog open={isAddLinkOpen} onOpenChange={setIsAddLinkOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>添加在线文档链接</DialogTitle>
                  <DialogDescription>
                    输入在线文档的名称和链接地址。
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddLink} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="link-name">文档名称</Label>
                    <Input
                      id="link-name"
                      placeholder="例如：产品需求文档"
                      value={linkName}
                      onChange={(e) => setLinkName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="link-url">链接地址</Label>
                    <Input
                      id="link-url"
                      placeholder="https://..."
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      type="url"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsAddLinkOpen(false)}>取消</Button>
                    <Button type="submit" disabled={isUploading}>
                      {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : '添加'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Create Document Dialog */}
            <Dialog open={isCreateDocOpen} onOpenChange={setIsCreateDocOpen}>
              <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>{editingDocId ? '编辑Markdown文档' : '创建Markdown文档'}</DialogTitle>
                  <DialogDescription>
                    {editingDocId ? '修改文档内容并保存更新。' : '创建一个新的Markdown文档并添加到知识库。'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 flex-1 overflow-y-auto">
                  <div className="space-y-2">
                    <Label htmlFor="doc-title">文档标题</Label>
                    <Input
                      id="doc-title"
                      placeholder="例如：产品使用指南"
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="doc-content">Markdown内容</Label>
                    <textarea
                      id="doc-content"
                      placeholder="# 标题&#10;&#10;在这里输入Markdown内容...&#10;&#10;支持标准Markdown语法：&#10;- 列表项&#10;- **粗体** 和 *斜体*&#10;- [链接](https://example.com)&#10;- 等等"
                      value={docContent}
                      onChange={(e) => setDocContent(e.target.value)}
                      className="w-full min-h-[300px] p-3 border rounded-md font-mono text-sm resize-y"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateDocOpen(false);
                      setDocTitle('');
                      setDocContent('');
                      setEditingDocId(null);
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleSaveDocument}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      '保存文档'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <div className="flex-1 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedDocs.length === documents.length && documents.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>文档名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>大小</TableHead>
                    <TableHead>上传时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                          <span className="text-sm font-medium">正在加载文档列表...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : documents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-2">
                          <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                            <FileText className="h-6 w-6 text-gray-400" />
                          </div>
                          <p className="font-medium text-gray-900">暂无文档</p>
                          <p className="text-sm">请点击上方按钮上传文档到知识库</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedDocs.includes(doc.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedDocs(prev => [...prev, doc.id]);
                              } else {
                                setSelectedDocs(prev => prev.filter(id => id !== doc.id));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {doc.type === 'link' && <LinkIcon className="h-4 w-4 text-blue-500" />}
                            {doc.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs uppercase">
                            {doc.type}
                          </span>
                        </TableCell>
                        <TableCell>
                          {doc.type === 'link' ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            typeof doc.size === 'number'
                              ? `${(doc.size / 1024 / 1024).toFixed(2)} MB`
                              : doc.size
                          )}
                        </TableCell>
                        <TableCell>{new Date(doc.uploadDate).toLocaleDateString('zh-CN')}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => doc.type.toLowerCase() === 'md' ? handleEditDocument(doc) : handlePreview(doc)}
                              title={doc.type === 'link' ? '访问链接' : (doc.type.toLowerCase() === 'md' ? '编辑文档' : '预览文档')}
                              disabled={isUploading}
                            >
                              {openingDocId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                              ) : (
                                doc.type === 'link' ? <ExternalLink className="h-4 w-4" /> : (doc.type.toLowerCase() === 'md' ? <FilePenLine className="h-4 w-4" /> : <Eye className="h-4 w-4" />)
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(doc.id)}
                              disabled={isUploading}
                            >
                              {deletingDocId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-red-500" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>


          </TabsContent>

        </Tabs>
      </DialogContent>

      {previewDoc && (
        <FilePreviewModal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          file={previewDoc ? {
            name: previewDoc.name,
            url: previewDoc.signedUrl || '',
            type: previewDoc.type
          } : null}
        />
      )}
    </Dialog>
  );
}