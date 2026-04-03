import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Loader2 } from 'lucide-react';
import { api, setAuthToken } from '@/services/api';
import { toast } from 'sonner';

interface AuthModalProps {
    isOpen: boolean;
    onLoginSuccess: (token: string, username: string) => void;
}

export function AuthModal({ isOpen, onLoginSuccess }: AuthModalProps) {
    const [activeTab, setActiveTab] = useState('login');
    const [isLoading, setIsLoading] = useState(false);

    // Login State
    const [loginUser, setLoginUser] = useState('');
    const [loginPass, setLoginPass] = useState('');

    // Register State
    const [regUser, setRegUser] = useState('');
    const [regPass, setRegPass] = useState('');
    const [regQuestion, setRegQuestion] = useState('');
    const [regAnswer, setRegAnswer] = useState('');

    // Reset State
    const [resetStep, setResetStep] = useState(1);
    const [resetUser, setResetUser] = useState('');
    const [resetQuestion, setResetQuestion] = useState('');
    const [resetAnswer, setResetAnswer] = useState('');
    const [resetNewPass, setResetNewPass] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginUser || !loginPass) {
            toast.error('请输入用户名和密码');
            return;
        }

        setIsLoading(true);
        try {
            const res = await api.auth.login(loginUser, loginPass);
            if (res.success && res.data) {
                setAuthToken(res.data.token);
                onLoginSuccess(res.data.token, res.data.username);
                toast.success(`欢迎回来，${res.data.username}`);
            } else {
                toast.error(res.error || '登录失败');
            }
        } catch (error) {
            toast.error('登录请求失败');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!regUser || !regPass || !regQuestion || !regAnswer) {
            toast.error('请填写所有必填项');
            return;
        }

        setIsLoading(true);
        try {
            const res = await api.auth.register({
                username: regUser,
                password: regPass,
                securityQuestion: regQuestion,
                securityAnswer: regAnswer
            });
            if (res.success) {
                toast.success('注册成功，请登录');
                setActiveTab('login');
                setLoginUser(regUser);
                setLoginPass('');
            } else {
                toast.error(res.error || '注册失败');
            }
        } catch (error) {
            toast.error('注册请求失败');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFetchQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetUser) {
            toast.error('请输入用户名');
            return;
        }

        setIsLoading(true);
        try {
            const res = await api.auth.getQuestion(resetUser);
            if (res.success && res.data) {
                setResetQuestion(res.data.question);
                setResetStep(2);
            } else {
                toast.error(res.error || '用户不存在');
            }
        } catch (error) {
            toast.error('获取密保问题失败');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetAnswer || !resetNewPass) {
            toast.error('请填写答案和新密码');
            return;
        }

        setIsLoading(true);
        try {
            const res = await api.auth.resetPassword({
                username: resetUser,
                securityAnswer: resetAnswer,
                newPassword: resetNewPass
            });
            if (res.success) {
                toast.success('密码重置成功，请登录');
                setActiveTab('login');
                setLoginUser(resetUser);
                setLoginPass('');
                // Reset state
                setResetStep(1);
                setResetUser('');
                setResetAnswer('');
                setResetNewPass('');
            } else {
                toast.error(res.error || '重置失败，答案可能错误');
            }
        } catch (error) {
            toast.error('重置请求失败');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-[425px] [&>button]:hidden">
                <DialogHeader>
                    <DialogTitle className="text-center text-xl">小鸣同学</DialogTitle>
                    <DialogDescription className="text-center">
                        请登录或注册账号以继续使用
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="login">登录</TabsTrigger>
                        <TabsTrigger value="register">注册</TabsTrigger>
                        <TabsTrigger value="reset">找回密码</TabsTrigger>
                    </TabsList>

                    {/* Login Tab */}
                    <TabsContent value="login">
                        <form onSubmit={handleLogin} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="login-user">用户名</Label>
                                <Input
                                    id="login-user"
                                    value={loginUser}
                                    onChange={(e) => setLoginUser(e.target.value)}
                                    placeholder="请输入用户名"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="login-pass">密码</Label>
                                <Input
                                    id="login-pass"
                                    type="password"
                                    value={loginPass}
                                    onChange={(e) => setLoginPass(e.target.value)}
                                    placeholder="请输入密码"
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '登录'}
                            </Button>
                        </form>
                    </TabsContent>

                    {/* Register Tab */}
                    <TabsContent value="register">
                        <form onSubmit={handleRegister} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="reg-user">用户名</Label>
                                <Input
                                    id="reg-user"
                                    value={regUser}
                                    onChange={(e) => setRegUser(e.target.value)}
                                    placeholder="设置用户名"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="reg-pass">密码</Label>
                                <Input
                                    id="reg-pass"
                                    type="password"
                                    value={regPass}
                                    onChange={(e) => setRegPass(e.target.value)}
                                    placeholder="设置密码"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="reg-question">密保问题 (用于找回密码)</Label>
                                <Input
                                    id="reg-question"
                                    value={regQuestion}
                                    onChange={(e) => setRegQuestion(e.target.value)}
                                    placeholder="例如：我的小学名字是？"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="reg-answer">密保答案</Label>
                                <Input
                                    id="reg-answer"
                                    value={regAnswer}
                                    onChange={(e) => setRegAnswer(e.target.value)}
                                    placeholder="请输入答案"
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '注册账号'}
                            </Button>
                        </form>
                    </TabsContent>

                    {/* Reset Tab */}
                    <TabsContent value="reset">
                        {resetStep === 1 ? (
                            <form onSubmit={handleFetchQuestion} className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="reset-user">请输入您的用户名</Label>
                                    <Input
                                        id="reset-user"
                                        value={resetUser}
                                        onChange={(e) => setResetUser(e.target.value)}
                                        placeholder="用户名"
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '下一步'}
                                </Button>
                            </form>
                        ) : (
                            <form onSubmit={handleResetPassword} className="space-y-4 pt-4">
                                <div className="p-3 bg-secondary/50 rounded-md text-sm">
                                    <span className="font-semibold">密保问题:</span> {resetQuestion}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reset-answer">密保答案</Label>
                                    <Input
                                        id="reset-answer"
                                        value={resetAnswer}
                                        onChange={(e) => setResetAnswer(e.target.value)}
                                        placeholder="请输入答案"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reset-new-pass">新密码</Label>
                                    <Input
                                        id="reset-new-pass"
                                        type="password"
                                        value={resetNewPass}
                                        onChange={(e) => setResetNewPass(e.target.value)}
                                        placeholder="设置新密码"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" className="w-full" onClick={() => setResetStep(1)}>
                                        上一步
                                    </Button>
                                    <Button type="submit" className="w-full" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '重置密码'}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
