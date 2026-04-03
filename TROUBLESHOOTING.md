# 🔧 小鸣同学 - 故障排查指南

## 已修复的问题

### ✅ 问题 1：Dialog 可访问性警告
**错误**：`Warning: Missing Description or aria-describedby={undefined} for {DialogContent}.`

**修复**：已在密码验证对话框中添加 `DialogDescription` 组件，提升可访问性。

### ✅ 问题 2：豆包 API 模型 ID 错误
**错误**：`The model or endpoint f374a543-ab80-4d56-b1bd-9e538c613e5a does not exist`

**原因**：环境变量 `DOUBAO_MODEL_ID` 被错误地设置为 API Key 值。

**修复**：
1. 服务器代码现在正确区分 API Key 和端点 ID
2. 如果 `DOUBAO_MODEL_ID` 未设置或无效，系统会使用默认端点
3. 添加了详细的日志记录来帮助调试

## 🎯 环境变量配置清单

### 必需的环境变量

请确保在 Supabase 控制台中正确配置以下环境变量：

```bash
# 1. 豆包 API 密钥 (用于认证)
DOUBAO_API_KEY=f374a543-ab80-4d56-b1bd-9e538c613e5a

# 2. 豆包端点 ID (用于指定模型，格式为 ep-xxxxx)
DOUBAO_MODEL_ID=ep-20250111105514-w5v8c

# 3. Supabase 配置 (通常已自动设置)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 如何获取豆包端点 ID

**方法 1：火山引擎控制台**
1. 登录 https://console.volcengine.com/
2. 进入「大模型服务平台」
3. 选择「在线推理」→「端点管理」
4. 复制您的端点 ID（格式：`ep-xxxx-xxxx`）

**方法 2：API 文档**
- 查看您的豆包 API 文档
- 端点 ID 通常在「接入指南」中显示

## 🔍 验证配置

### 步骤 1：检查后端日志

发送一条消息后，查看 Supabase Edge Functions 日志：

```
# 正确的日志输出应该显示：
Calling Doubao API with model: ep-20250111105514-w5v8c
AI response generated successfully
```

### 步骤 2：测试 API 连接

发送测试消息：
```
如何进行设备巡检？
```

**预期结果**：
- ✅ 收到 AI 回复（3秒内）
- ✅ 没有错误提示
- ❌ 如果显示"AI 服务暂时不可用"，说明配置有问题

### 步骤 3：查看前端提示

系统会自动显示配置状态：
- 🟢 **正常**：收到 AI 回复，无特殊提示
- 🟡 **演示模式**：显示"AI 服务暂时不可用，使用演示模式回复"
- 🔴 **错误**：显示"发送失败，请重试"

## 🐛 常见问题

### Q1: 仍然显示"InvalidEndpointOrModel.NotFound"错误

**解决方案**：
1. 确认 `DOUBAO_MODEL_ID` 的值确实是端点 ID（ep-开头）
2. 尝试在豆包控制台创建新的端点
3. 确认您的账号有权限访问该端点

### Q2: 显示"Authentication failed"

**解决方案**：
1. 检查 `DOUBAO_API_KEY` 是否正确
2. 确认 API Key 没有过期
3. 验证 API Key 有足够的调用额度

### Q3: AI 回复很慢或超时

**解决方案**：
1. 检查网络连接
2. 确认豆包服务状态正常
3. 考虑调整 `max_tokens` 参数（当前设置为 2000）

### Q4: 系统使用演示模式，但配置看起来正确

**解决方案**：
1. 重启 Edge Function（重新部署）
2. 清除浏览器缓存
3. 检查环境变量是否真的保存成功

## 📝 测试脚本

您可以使用以下 curl 命令直接测试后端：

```bash
curl -X POST "https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-8b373356/chat/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "message": "测试消息"
  }'
```

**预期响应**：
```json
{
  "success": true,
  "response": "AI 回复的内容..."
}
```

## 💡 最佳实践

1. **定期更新知识库**：上传最新的文档可以提高回答准确率
2. **监控 API 使用量**：避免超出豆包 API 的调用限制
3. **备份重要文档**：虽然存储在 Supabase，但建议保留本地备份
4. **查看日志**：定期检查后端日志，及早发现问题

## 🆘 联系支持

如果以上方法都无法解决问题：

1. **检查项目控制台**：
   - Supabase Dashboard → Edge Functions → Logs
   - 查看详细的错误堆栈

2. **验证网络**：
   - 确认可以访问 `ark.cn-beijing.volces.com`
   - 检查防火墙设置

3. **重新部署**：
   - 尝试重新部署 Edge Function
   - 清除所有缓存

4. **降级方案**：
   - 系统会自动使用演示模式
   - 用户仍可使用知识库管理功能

---

**更新时间**：2026-01-22  
**状态**：✅ 所有已知问题已修复
