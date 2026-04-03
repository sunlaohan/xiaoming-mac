import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Loader2, ThumbsUp, ThumbsDown, MessageSquare, HelpCircle, X } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import type { AnalyticsStats, ChatLog } from '@/types';

interface ServiceAnalyticsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ServiceAnalyticsModal({ isOpen, onClose }: ServiceAnalyticsModalProps) {
    const [analyticsStats, setAnalyticsStats] = useState<AnalyticsStats>({
        totalQuestions: 0,
        totalAnswers: 0,
        totalLikes: 0,
        totalDislikes: 0
    });
    const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadAnalytics();
        }
    }, [isOpen]);

    const loadAnalytics = async () => {
        setIsLoading(true);
        try {
            const res = await api.analytics.getData();
            if (res.success && res.data) {
                setAnalyticsStats(res.data.stats);
                setChatLogs(res.data.logs);
            } else {
                throw new Error(res.error || 'Failed to load analytics');
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
            toast.error('获取分析数据失败');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[900px] h-[80vh] flex flex-col app-region-no-drag">
                <DialogHeader>
                    <DialogTitle>服务运行分析</DialogTitle>
                    <DialogDescription>
                        查看小鸣同学的使用情况与用户反馈统计
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex flex-col overflow-hidden gap-4">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex flex-col">
                            <span className="text-xs text-blue-500 font-medium mb-1 flex items-center gap-1">
                                <HelpCircle className="h-3 w-3" /> 提问总数
                            </span>
                            <span className="text-2xl font-bold text-blue-700">{analyticsStats.totalQuestions}</span>
                        </div>
                        <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg flex flex-col">
                            <span className="text-xs text-purple-500 font-medium mb-1 flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" /> 回答总数
                            </span>
                            <span className="text-2xl font-bold text-purple-700">{analyticsStats.totalAnswers}</span>
                        </div>
                        <div className="p-3 bg-green-50 border border-green-100 rounded-lg flex flex-col">
                            <span className="text-xs text-green-500 font-medium mb-1 flex items-center gap-1">
                                <ThumbsUp className="h-3 w-3" /> 获赞数
                            </span>
                            <span className="text-2xl font-bold text-green-700">{analyticsStats.totalLikes}</span>
                        </div>
                        <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex flex-col">
                            <span className="text-xs text-red-500 font-medium mb-1 flex items-center gap-1">
                                <ThumbsDown className="h-3 w-3" /> 不满意数
                            </span>
                            <span className="text-2xl font-bold text-red-700">{analyticsStats.totalDislikes}</span>
                        </div>
                    </div>

                    {/* Logs Table */}
                    <div className="flex-1 border rounded-lg relative overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-hidden hover:overflow-y-auto">
                            <Table className="w-full table-fixed">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[140px] hidden lg:table-cell">时间</TableHead>
                                        <TableHead className="w-[80px] sm:w-[160px]">用户提问</TableHead>
                                        <TableHead>AI 回答</TableHead>
                                        <TableHead className="w-[50px] sm:w-[80px] text-center p-2">反馈</TableHead>
                                        <TableHead className="hidden lg:table-cell">不赞同原因</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={5}>
                                                <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-3">
                                                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                                                    <span className="text-sm font-medium">正在加载分析数据...</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : chatLogs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5}>
                                                <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-2">
                                                    <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                                                        <MessageSquare className="h-6 w-6 text-gray-400" />
                                                    </div>
                                                    <p className="font-medium text-gray-900">暂无问答记录</p>
                                                    <p className="text-sm">系统暂未收到用户提问</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        chatLogs.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell className="text-xs text-gray-500 break-words align-top hidden lg:table-cell">
                                                    {new Date(log.timestamp).toLocaleString('zh-CN')}
                                                </TableCell>
                                                <TableCell className="font-medium align-top">
                                                    <div title={log.question} style={{
                                                        display: '-webkit-box',
                                                        WebkitBoxOrient: 'vertical',
                                                        WebkitLineClamp: 2,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        wordBreak: 'break-word'
                                                    }}>
                                                        {log.question}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="align-top text-gray-600">
                                                    <div className="text-sm" title={log.answer} style={{
                                                        display: '-webkit-box',
                                                        WebkitBoxOrient: 'vertical',
                                                        WebkitLineClamp: 3,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        wordBreak: 'break-word'
                                                    }}>
                                                        {log.answer}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center align-top p-2">
                                                    {log.feedback?.type === 'like' && <ThumbsUp className="h-4 w-4 text-green-500 mx-auto" />}
                                                    {log.feedback?.type === 'dislike' && <ThumbsDown className="h-4 w-4 text-red-500 mx-auto" />}
                                                </TableCell>
                                                <TableCell className="text-xs text-gray-500 align-top hidden lg:table-cell">
                                                    {log.feedback?.type === 'dislike' && log.feedback.reason ? log.feedback.reason : '-'}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
