
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Loader2, Lock, ShieldQuestion } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import type { ModelConfig } from '@/types';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    username: string;
    onLogout: () => void;
    modelConfig: ModelConfig | null;
    onModelConfigUpdated: (config: ModelConfig) => void;
    onUsernameUpdated: (username: string) => void;
}

export function UserProfileModal({ isOpen, onClose, username, onLogout, modelConfig, onModelConfigUpdated, onUsernameUpdated }: UserProfileModalProps) {
    const [activeTab, setActiveTab] = useState('password');
    const [isLoading, setIsLoading] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState('');

    // Password Update State
    const [pwSecurityAnswer, setPwSecurityAnswer] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // Question Update State
    const [qCurrentPassword, setQCurrentPassword] = useState('');
    const [newQuestion, setNewQuestion] = useState('');
    const [newAnswer, setNewAnswer] = useState('');
    const [modelId, setModelId] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [renamePassword, setRenamePassword] = useState('');
    const [newUsername, setNewUsername] = useState('');

    // Fetch security question when modal opens
    useEffect(() => {
        if (isOpen && username) {
            fetchQuestion();
        }
    }, [isOpen, username]);

    useEffect(() => {
        setModelId(modelConfig?.modelId ?? '');
        setApiKey(modelConfig?.apiKey ?? '');
        setNewUsername(username);
    }, [modelConfig, isOpen]);

    const normalizedUsername = newUsername.trim();

    const fetchQuestion = async () => {
        try {
            const res = await api.auth.getQuestion(username);
            if (res.success && res.data) {
                setCurrentQuestion(res.data.question);
            }
        } catch (error) {
            console.error('Failed to fetch security question:', error);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pwSecurityAnswer || !newPassword) {
            toast.error('请填写所有必填项');
            return;
        }

        setIsLoading(true);
        try {
            const res = await api.auth.updatePassword({
                securityAnswer: pwSecurityAnswer,
                newPassword: newPassword
            });

            if (res.success) {
                toast.success('密码修改成功');
                setPwSecurityAnswer('');
                setNewPassword('');
                onClose();
            } else {
                toast.error(res.error || '密码修改失败，请检查密保答案');
            }
        } catch (error) {
            toast.error('请求失败');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!qCurrentPassword || !newQuestion || !newAnswer) {
            toast.error('请填写所有必填项');
            return;
        }

        setIsLoading(true);
        try {
            const res = await api.auth.updateQuestion({
                password: qCurrentPassword,
                newQuestion: newQuestion,
                newAnswer: newAnswer
            });

            if (res.success) {
                toast.success('密保问题修改成功');
                setQCurrentPassword('');
                setNewQuestion('');
                setNewAnswer('');
                fetchQuestion(); // Refresh displayed question
            } else {
                toast.error(res.error || '修改失败，请检查当前密码');
            }
        } catch (error) {
            toast.error('请求失败');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateModelConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modelId.trim() || !apiKey.trim()) {
            toast.error('请填写模型ID和API Key');
            return;
        }

        setIsLoading(true);
        try {
            const res = await api.auth.updateModelConfig({
                modelId: modelId.trim(),
                apiKey: apiKey.trim(),
            });

            if (res.success && res.data?.config) {
                onModelConfigUpdated(res.data.config);
                toast.success('模型配置修改成功');
            } else {
                toast.error(res.error || '模型配置修改失败');
            }
        } catch (error) {
            toast.error('请求失败');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateUsername = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!renamePassword || !normalizedUsername) {
            toast.error('请填写当前密码和新账号');
            return;
        }

        if (normalizedUsername === username) {
            toast.info('新账号与当前账号一致，无需修改');
            return;
        }

        if (normalizedUsername.length < 2 || normalizedUsername.length > 20) {
            toast.error('账号长度请保持在 2 到 20 个字符之间');
            return;
        }

        setIsLoading(true);
        try {
            const res = await api.auth.updateUsername({
                password: renamePassword,
                newUsername: normalizedUsername,
            });

            if (res.success && res.data?.username) {
                onUsernameUpdated(res.data.username);
                setRenamePassword('');
                onClose();
                toast.success('账号修改成功');
            } else {
                toast.error(res.error || '账号修改失败');
            }
        } catch (error) {
            toast.error('请求失败');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>账号设置</DialogTitle>
                    <DialogDescription>
                        管理您的账户安全设置
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="password">修改密码</TabsTrigger>
                        <TabsTrigger value="question">修改密保</TabsTrigger>
                        <TabsTrigger value="username">修改账号</TabsTrigger>
                        <TabsTrigger value="model">模型配置</TabsTrigger>
                        <TabsTrigger value="danger" className="text-destructive data-[state=active]:text-destructive">注销账号</TabsTrigger>
                    </TabsList>

                    {/* Update Password Tab */}
                    <TabsContent value="password">
                        <form onSubmit={handleUpdatePassword} className="space-y-4 pt-4">
                            <div className="p-3 bg-secondary/50 rounded-md text-sm">
                                <div className="font-semibold mb-1 flex items-center gap-2">
                                    <ShieldQuestion className="h-4 w-4" />
                                    当前密保问题:
                                </div>
                                {currentQuestion || '加载中...'}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="pw-answer">密保答案</Label>
                                <Input
                                    id="pw-answer"
                                    value={pwSecurityAnswer}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPwSecurityAnswer(e.target.value)}
                                    placeholder="请输入密保答案验证身份"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="new-password">新密码</Label>
                                <Input
                                    id="new-password"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                                    placeholder="设置新密码"
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '确认修改密码'}
                            </Button>
                        </form>
                    </TabsContent>

                    <TabsContent value="model">
                        <form onSubmit={handleUpdateModelConfig} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="profile-model-id">模型ID</Label>
                                <Input
                                    id="profile-model-id"
                                    value={modelId}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setModelId(e.target.value)}
                                    placeholder="请输入模型ID"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="profile-api-key">API Key</Label>
                                <Input
                                    id="profile-api-key"
                                    type="password"
                                    value={apiKey}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
                                    placeholder="请输入API Key"
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '保存模型配置'}
                            </Button>
                        </form>
                    </TabsContent>

                    <TabsContent value="username">
                        <form onSubmit={handleUpdateUsername} className="space-y-4 pt-4">
                            <div className="p-3 bg-secondary/50 rounded-md text-sm text-gray-600">
                                修改后会同步更新当前登录账号、知识库、对话记录和反馈数据。
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="rename-password">当前密码</Label>
                                <Input
                                    id="rename-password"
                                    type="password"
                                    value={renamePassword}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRenamePassword(e.target.value)}
                                    placeholder="请输入当前密码"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="new-username">新账号</Label>
                                <Input
                                    id="new-username"
                                    value={newUsername}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUsername(e.target.value)}
                                    placeholder="请输入新的账号名称"
                                    maxLength={20}
                                />
                                <p className="text-xs text-gray-500">支持 2-20 个字符，建议使用字母、数字或中文名称。</p>
                            </div>

                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '确认修改账号'}
                            </Button>
                        </form>
                    </TabsContent>

                    {/* Update Question Tab */}
                    <TabsContent value="question">
                        <form onSubmit={handleUpdateQuestion} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="q-password">当前密码</Label>
                                <Input
                                    id="q-password"
                                    type="password"
                                    value={qCurrentPassword}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQCurrentPassword(e.target.value)}
                                    placeholder="请输入当前密码验证身份"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="new-question">新密保问题</Label>
                                <Input
                                    id="new-question"
                                    value={newQuestion}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewQuestion(e.target.value)}
                                    placeholder="例如：我的宠物名字是？"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="new-answer">新密保答案</Label>
                                <Input
                                    id="new-answer"
                                    value={newAnswer}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAnswer(e.target.value)}
                                    placeholder="设置密保答案"
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '确认修改密保'}
                            </Button>
                        </form>
                    </TabsContent>

                    {/* Delete Account Tab */}
                    <TabsContent value="danger">
                        <div className="space-y-4 pt-4">
                            <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-md text-sm text-destructive">
                                <h4 className="font-semibold mb-2 flex items-center gap-2">
                                    <Lock className="h-4 w-4" />
                                    危险操作警告
                                </h4>
                                <p>注销账号将永久删除您的所有数据，包括文档、知识库和对话记录。此操作无法撤销。</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="del-password">输入密码确认</Label>
                                <Input
                                    id="del-password"
                                    type="password"
                                    value={qCurrentPassword}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQCurrentPassword(e.target.value)}
                                    placeholder="请输入当前密码"
                                />
                            </div>

                            <Button
                                variant="destructive"
                                className="w-full"
                                disabled={isLoading || !qCurrentPassword}
                                onClick={async () => {
                                    if (!window.confirm('确定要永久注销账号吗？无法恢复！')) return;

                                    setIsLoading(true);
                                    try {
                                        const res = await api.auth.deleteAccount(qCurrentPassword);
                                        if (res.success) {
                                            toast.success('账号已注销');
                                            onClose();
                                            onLogout();
                                        } else {
                                            toast.error(res.error || '注销失败，请检查密码');
                                        }
                                    } catch (error) {
                                        toast.error('请求失败');
                                    } finally {
                                        setIsLoading(false);
                                    }
                                }}
                            >
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '确认注销账号'}
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
