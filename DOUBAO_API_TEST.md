# 🧪 豆包 API 测试指南

## 📋 测试清单

根据您提供的官方示例，系统现在已更新为使用正确的豆包 API 格式。

## 🔧 官方 API 示例（您提供的）

```bash
curl https://ark.cn-beijing.volces.com/api/v3/responses \
-H "Authorization: Bearer f374a543-ab80-4d56-b1bd-9e538c613e5a" \
-H 'Content-Type: application/json' \
-d '{
    "model": "doubao-seed-1-8-251228",
    "input": [
        {
            "role": "user",
            "content": [
                {
                    "type": "input_image",
                    "image_url": "https://ark-project.tos-cn-beijing.volces.com/doc_image/ark_demo_img_1.png"
                },
                {
                    "type": "input_text",
                    "text": "你看见了什么？"
                }
            ]
        }
    ]
}'
```

## ✅ 系统实现对比

### 官方格式 vs 系统实现

| 项目 | 官方示例 | 系统实现 | 状态 |
|------|---------|---------|------|
| **端点** | `/api/v3/responses` | `/api/v3/responses` | ✅ 匹配 |
| **认证方式** | `Bearer {API_KEY}` | `Bearer {API_KEY}` | ✅ 匹配 |
| **模型参数** | `doubao-seed-1-8-251228` | `doubao-seed-1-8-251228` | ✅ 匹配 |
| **输入格式** | `input[].content[]` | `input[].content[]` | ✅ 匹配 |
| **文本类型** | `input_text` | `input_text` | ✅ 匹配 |
| **图片类型** | `input_image` | `input_image` | ✅ 匹配 |

## 🎯 系统实现细节

### 服务器端代码

```typescript
// /supabase/functions/server/index.tsx

// Prepare input content in Doubao format
const inputContent = [];

// Add system prompt as first message
inputContent.push({
  type: 'input_text',
  text: systemPrompt
});

// Add image if provided
if (image) {
  inputContent.push({
    type: 'input_image',
    image_url: image
  });
}

// Add user message
inputContent.push({
  type: 'input_text',
  text: message
});

// Call Doubao API using /responses endpoint (official format)
const doubaoResponse = await fetch('https://ark.cn-beijing.volces.com/api/v3/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${doubaoApiKey}`,
  },
  body: JSON.stringify({
    model: modelToUse,
    input: [
      {
        role: 'user',
        content: inputContent
      }
    ]
  }),
});
```

### 响应处理

```typescript
const doubaoData = await doubaoResponse.json();

// Extract response from Doubao format
const aiResponse = doubaoData.output?.text || 
                   doubaoData.choices?.[0]?.message?.content || 
                   getMockResponse(message, !!image);
```

## 🧪 测试步骤

### 步骤 1：验证环境变量

```bash
# 在 Supabase Edge Functions Secrets 中确认
DOUBAO_API_KEY=f374a543-ab80-4d56-b1bd-9e538c613e5a
DOUBAO_MODEL_ID=doubao-seed-1-8-251228
```

### 步骤 2：发送测试消息

在 MEOS 应用中：
1. 打开聊天界面
2. 输入测试问题，例如："你好，请介绍一下MEOS系统"
3. 点击发送

### 步骤 3：检查日志

打开浏览器控制台（F12），查看：
```
Calling Doubao API with model: doubao-seed-1-8-251228
AI response generated successfully
```

### 步骤 4：测试多模态（图片+文字）

1. 在聊天界面点击图片上传
2. 选择一张图片
3. 输入问题："这张图片显示了什么？"
4. 发送消息

## 📊 预期结果

### 成功的响应

```json
{
  "success": true,
  "response": "您好！我是MEOS小觅AI助手..."
}
```

### 请求体格式

```json
{
  "model": "doubao-seed-1-8-251228",
  "input": [
    {
      "role": "user",
      "content": [
        {
          "type": "input_text",
          "text": "系统提示词..."
        },
        {
          "type": "input_image",
          "image_url": "data:image/jpeg;base64,..."
        },
        {
          "type": "input_text",
          "text": "用户的问题"
        }
      ]
    }
  ]
}
```

### 豆包 API 响应格式

```json
{
  "output": {
    "text": "AI生成的回答内容"
  },
  "usage": {
    "prompt_tokens": 123,
    "completion_tokens": 456,
    "total_tokens": 579
  }
}
```

## 🐛 故障排除

### 问题 1：仍然收到模型不存在错误

**检查**：
1. 确认 `DOUBAO_MODEL_ID` = `doubao-seed-1-8-251228`（不是 API Key）
2. 确认 `DOUBAO_API_KEY` = `f374a543-ab80-4d56-b1bd-9e538c613e5a`

**验证**：
```bash
# 在服务器日志中应该看到
Calling Doubao API with model: doubao-seed-1-8-251228
```

### 问题 2：认证失败

**检查**：
1. API Key 是否正确
2. API Key 是否有调用额度
3. Bearer token 格式是否正确

**验证**：
```bash
# 使用 curl 测试
curl https://ark.cn-beijing.volces.com/api/v3/responses \
  -H "Authorization: Bearer f374a543-ab80-4d56-b1bd-9e538c613e5a" \
  -H 'Content-Type: application/json' \
  -d '{"model":"doubao-seed-1-8-251228","input":[{"role":"user","content":[{"type":"input_text","text":"测试"}]}]}'
```

### 问题 3：返回空响应

**原因**：响应格式解析错误

**检查代码**：
```typescript
// 应该使用 output.text 而不是 choices[0].message.content
const aiResponse = doubaoData.output?.text;
```

### 问题 4：图片上传失败

**检查**：
1. 图片大小是否小于 10MB
2. 图片格式是否为 JPG/PNG/WEBP
3. Base64 编码是否正确

## 📝 详细日志示例

### 成功调用的完整日志

```
[INFO] Calling Doubao API with model: doubao-seed-1-8-251228
[DEBUG] Request body: {
  "model": "doubao-seed-1-8-251228",
  "input": [
    {
      "role": "user",
      "content": [
        {
          "type": "input_text",
          "text": "你是MEOS小觅AI助手..."
        },
        {
          "type": "input_text",
          "text": "如何进行设备巡检？"
        }
      ]
    }
  ]
}
[DEBUG] Doubao API response: {
  "output": {
    "text": "关于设备巡检流程，请按以下步骤操作..."
  },
  "usage": {
    "prompt_tokens": 45,
    "completion_tokens": 128,
    "total_tokens": 173
  }
}
[INFO] AI response generated successfully
```

### 失败调用的日志

```
[ERROR] Doubao API error: 400
[ERROR] Response: {
  "error": {
    "message": "Invalid model name",
    "type": "invalid_request_error"
  }
}
```

## ✅ 验证清单

在测试之前，请确认：

- [ ] 代码已更新为使用 `/responses` 端点
- [ ] `DOUBAO_API_KEY` 环境变量已设置
- [ ] `DOUBAO_MODEL_ID` 设置为 `doubao-seed-1-8-251228`
- [ ] 请求格式使用 `input_text` 和 `input_image`
- [ ] 响应解析使用 `output.text`
- [ ] 系统提示词已正确添加
- [ ] 知识库文档列表已注入上下文

## 🔍 调试技巧

### 1. 查看完整请求和响应

在服务器代码中添加日志：
```typescript
console.log('Request body:', JSON.stringify(requestBody, null, 2));
console.log('Doubao API response:', JSON.stringify(doubaoData, null, 2));
```

### 2. 使用 curl 直接测试

```bash
curl -v https://ark.cn-beijing.volces.com/api/v3/responses \
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

### 3. 检查环境变量

在服务器启动时添加日志：
```typescript
console.log('DOUBAO_API_KEY:', Deno.env.get('DOUBAO_API_KEY') ? '已设置' : '未设置');
console.log('DOUBAO_MODEL_ID:', Deno.env.get('DOUBAO_MODEL_ID'));
```

## 🎉 成功标志

如果一切配置正确，您应该看到：

1. ✅ 聊天界面显示 AI 的回复
2. ✅ 控制台日志显示 "AI response generated successfully"
3. ✅ 没有 "fallback: true" 标记
4. ✅ 响应内容符合 MEOS 助手的风格
5. ✅ 图片上传和识别功能正常工作

## 📞 需要帮助？

如果测试失败：
1. 查看 `/DOUBAO_SETUP_GUIDE.md` 了解配置详情
2. 查看 `/TROUBLESHOOTING.md` 获取常见问题解决方案
3. 检查浏览器和服务器的控制台日志
4. 确认 API Key 有足够的调用额度

---

**测试版本**：v2.0  
**API 端点**：`https://ark.cn-beijing.volces.com/api/v3/responses`  
**模型**：`doubao-seed-1-8-251228`  
**最后更新**：2026-01-22
