# 🔍 配置检查和修复指南

## ✅ 已应用的紧急修复

系统已经添加了**自动保护机制**，现在会自动检测并防止使用 API Key 作为模型名称。

### 修复内容

```typescript
// 服务器会自动检测 DOUBAO_MODEL_ID 是否是 API Key
// 如果是 UUID 格式 (f374a543-ab80-4d56-b1bd-9e538c613e5a)，会自动使用默认模型
const looksLikeApiKey = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(doubaoModelId);

if (looksLikeApiKey) {
  console.warn(`⚠️ DOUBAO_MODEL_ID appears to be an API Key, using default model instead`);
  modelToUse = 'doubao-seed-1-8-251228';  // 自动使用正确的模型
}
```

---

## 🎯 现在请测试

### 步骤 1：刷新页面

强制刷新浏览器（Ctrl+Shift+R 或 Cmd+Shift+R）

### 步骤 2：打开控制台

按 F12 打开开发者工具

### 步骤 3：发送测试消息

在聊天界面输入："你好"

### 步骤 4：查看日志

**应该看到以下内容之一**：

#### 场景 A：自动修复生效（推荐）

```
⚠️ DOUBAO_MODEL_ID appears to be an API Key (f374a543-ab80-4d56-b1bd-9e538c613e5a), using default model instead
⚠️ Please set DOUBAO_MODEL_ID to: doubao-seed-1-8-251228
Calling Doubao API with model: doubao-seed-1-8-251228  ← 使用正确的模型
Doubao API response received
AI response generated successfully
```

**结果**：✅ AI 正常工作，但应该修复配置

#### 场景 B：配置正确

```
Calling Doubao API with model: doubao-seed-1-8-251228
Doubao API response received
AI response generated successfully
```

**结果**：✅ 完美！配置正确

#### 场景 C：仍然有错误

```
Doubao API error: 404 {...}
```

**结果**：❌ 需要进一步调查

---

## 📊 当前状态诊断

### 检查环境变量

在 Supabase 控制台 → Edge Functions → Settings → Secrets 中检查：

| Secret 名称 | 当前值（可能） | 应该是 | 状态 |
|------------|---------------|--------|------|
| `DOUBAO_API_KEY` | `f374a543-ab80-4d56-b1bd-9e538c613e5a` | `f374a543-ab80-4d56-b1bd-9e538c613e5a` | ✅ |
| `DOUBAO_MODEL_ID` | `f374a543-ab80-4d56-b1bd-9e538c613e5a` ❌ | `doubao-seed-1-8-251228` | ❌ 需要修复 |

---

## 🔧 永久修复方法

虽然系统现在会自动绕过错误配置，但**强烈建议**正确设置环境变量。

### 方法 1：通过 Supabase UI（推荐）

1. **登录 Supabase 控制台**
   - 访问：https://supabase.com/dashboard
   - 选择项目

2. **导航到 Secrets**
   ```
   Edge Functions → Settings → Secrets
   ```

3. **修改或添加 DOUBAO_MODEL_ID**
   
   如果已存在：
   - 点击编辑按钮
   - 将值从 `f374a543-ab80-4d56-b1bd-9e538c613e5a` 改为 `doubao-seed-1-8-251228`
   - 保存
   
   如果不存在：
   - 点击 "Add Secret"
   - Name: `DOUBAO_MODEL_ID`
   - Value: `doubao-seed-1-8-251228`
   - 保存

4. **重新部署函数**
   - 找到 `make-server-8b373356` 函数
   - 点击 "Redeploy"

### 方法 2：删除错误的 Secret

如果 `DOUBAO_MODEL_ID` 设置错误，您也可以直接删除它：

1. 在 Secrets 页面找到 `DOUBAO_MODEL_ID`
2. 点击删除按钮
3. 重新部署函数

系统会自动使用默认的正确模型名称 `doubao-seed-1-8-251228`。

### 方法 3：使用 Supabase CLI

```bash
# 设置正确的模型 ID
supabase secrets set DOUBAO_MODEL_ID=doubao-seed-1-8-251228

# 或者删除错误的设置（系统会使用默认值）
supabase secrets unset DOUBAO_MODEL_ID

# 重新部署
supabase functions deploy make-server-8b373356
```

---

## 🧪 验证修复

### 测试 1：检查日志中的模型名称

发送消息后，控制台应该显示：
```
Calling Doubao API with model: doubao-seed-1-8-251228
```

**不应该**显示：
```
Calling Doubao API with model: f374a543-ab80-4d56-b1bd-9e538c613e5a
```

### 测试 2：检查警告消息

如果看到警告：
```
⚠️ DOUBAO_MODEL_ID appears to be an API Key
```

说明配置仍然错误，但系统已自动修复。建议按照上述步骤永久修复。

### 测试 3：检查 AI 响应

- ✅ AI 应该正常回复
- ✅ 没有 404 错误
- ✅ 响应符合 MEOS 助手的风格

---

## 📋 故障排除检查清单

请逐项检查：

- [ ] 已刷新浏览器页面
- [ ] 开发者工具已打开
- [ ] 已发送测试消息
- [ ] 已查看控制台日志
- [ ] 确认日志中显示正确的模型名称
- [ ] AI 正常回复（没有 404 错误）
- [ ] （可选）已在 Supabase 中修复配置
- [ ] （可选）已重新部署 Edge Function

---

## 🎯 三种可能的结果

### 结果 1：自动修复生效 ✅

**现象**：
- 控制台有警告消息
- 但 AI 正常工作
- 使用模型 `doubao-seed-1-8-251228`

**建议**：
- 系统暂时可用
- **建议**在 Supabase 中修复配置以移除警告

### 结果 2：配置正确 ✅✅

**现象**：
- 没有警告消息
- AI 正常工作
- 使用模型 `doubao-seed-1-8-251228`

**建议**：
- 完美！无需任何操作

### 结果 3：仍然有错误 ❌

**现象**：
- 仍然看到 404 错误
- 或其他 API 错误

**建议**：
1. 检查 `DOUBAO_API_KEY` 是否正确设置
2. 使用 curl 测试 API Key 是否有效
3. 检查 API Key 是否有调用额度
4. 查看详细的错误日志

---

## 🔐 API Key 验证

使用以下命令验证您的 API Key 是否有效：

```bash
curl https://ark.cn-beijing.volces.com/api/v3/responses \
  -H "Authorization: Bearer f374a543-ab80-4d56-b1bd-9e538c613e5a" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "doubao-seed-1-8-251228",
    "input": [{
      "role": "user",
      "content": [{
        "type": "input_text",
        "text": "你好"
      }]
    }]
  }'
```

**预期响应**（API Key 有效）：
```json
{
  "output": {
    "text": "您好！有什么我可以帮助您的吗？"
  }
}
```

**错误响应**（API Key 无效）：
```json
{
  "error": {
    "code": "InvalidAuthentication",
    "message": "Invalid API key"
  }
}
```

---

## 📝 环境变量参考

### 完整的配置示例

```bash
# 必需的环境变量
DOUBAO_API_KEY=f374a543-ab80-4d56-b1bd-9e538c613e5a       # ✅ API 认证密钥
DOUBAO_MODEL_ID=doubao-seed-1-8-251228                    # ✅ 模型名称

# Supabase 配置（通常自动设置）
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_DB_URL=postgresql://...
```

### 常见错误配置

```bash
# ❌ 错误 1：MODEL_ID 使用了 API Key
DOUBAO_MODEL_ID=f374a543-ab80-4d56-b1bd-9e538c613e5a  # 这是 API Key！

# ❌ 错误 2：使用了端点 ID 而不是模型名称（旧版本）
DOUBAO_MODEL_ID=ep-20250111105514-w5v8c

# ❌ 错误 3：拼写错误
DOUBAO_API_KEy=...  # 注意大小写
DOUBAO_MODELID=...  # 缺少下划线
```

---

## 💡 专业提示

### 提示 1：使用默认值

如果您不确定应该设置什么，可以完全删除 `DOUBAO_MODEL_ID`：
- 系统会自动使用 `doubao-seed-1-8-251228`
- 这是官方推荐的多模态模型

### 提示 2：监控日志

在聊天时保持控制台打开：
- 可以实时看到使用的模型名称
- 可以快速发现配置问题

### 提示 3：验证后再使用

配置更改后：
1. 等待 1-2 分钟
2. 强制刷新浏览器
3. 发送测试消息
4. 检查日志确认正确

---

## 🆘 需要帮助？

如果按照本指南操作后仍有问题：

1. **收集诊断信息**：
   - 控制台完整日志
   - Supabase Secrets 截图（隐藏敏感值）
   - 错误消息的完整文本

2. **检查相关文档**：
   - `ERROR_FIX_GUIDE.md` - 错误修复详细说明
   - `DOUBAO_SETUP_GUIDE.md` - 配置详细指南
   - `DOUBAO_API_TEST.md` - API 测试方法

3. **尝试 Fallback 模式**：
   - 即使 API 不可用，系统也会使用演示模式
   - 可以继续测试其他功能

---

**修复版本**：v2.2  
**最后更新**：2026-01-22  
**新增功能**：自动检测并防止使用 API Key 作为模型名称
