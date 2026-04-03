# 🚀 豆包 API 配置指南

## ⚠️ 重要说明

环境变量 `DOUBAO_MODEL_ID` 应该设置为**豆包模型名称**（如 `doubao-seed-1-8-251228`），而不是端点 ID。

## 🔧 正确的 API 调用方式

根据豆包官方文档，系统使用以下端点：

```bash
POST https://ark.cn-beijing.volces.com/api/v3/responses
```

### 请求格式

```json
{
  "model": "doubao-seed-1-8-251228",
  "input": [
    {
      "role": "user",
      "content": [
        {
          "type": "input_text",
          "text": "你的问题"
        },
        {
          "type": "input_image",
          "image_url": "图片URL（可选）"
        }
      ]
    }
  ]
}
```

### 响应格式

```json
{
  "output": {
    "text": "AI的回答"
  }
}
```

## 🎯 环境变量配置

### 正确配置

```bash
# API 密钥 (用于认证)
DOUBAO_API_KEY=f374a543-ab80-4d56-b1bd-9e538c613e5a

# 模型名称 (用于指定使用的模型)
DOUBAO_MODEL_ID=doubao-seed-1-8-251228
```

### ❌ 常见错误配置

```bash
# 错误1：将 API Key 设置为 MODEL_ID
DOUBAO_MODEL_ID=f374a543-ab80-4d56-b1bd-9e538c613e5a  # ❌ 错误

# 错误2：使用端点 ID 而不是模型名称
DOUBAO_MODEL_ID=ep-20250111105514-w5v8c  # ❌ 这是旧版本的配置方式
```

## 🔍 如何获取模型名称

### 方法 1：查看官方文档

访问[火山引擎豆包 API 文档](https://www.volcengine.com/docs/82379/1298454)查看可用的模型列表。

### 方法 2：常用模型名称

| 模型名称 | 说明 |
|---------|------|
| `doubao-seed-1-8-251228` | 豆包 Seed 1.8 版本（支持多模态） |
| `doubao-pro` | 豆包 Pro 版本 |
| `doubao-lite` | 豆包 Lite 版本（更快更经济） |

## 📝 配置步骤

### 步骤 1：获取 API Key

1. 登录[火山引擎控制台](https://console.volcengine.com/)
2. 进入「大模型服务平台」→「API 管理」
3. 创建或复制您的 API Key

### 步骤 2：选择模型

1. 在控制台查看可用的模型列表
2. 选择适合您需求的模型（推荐使用 `doubao-seed-1-8-251228` 支持多模态）

### 步骤 3：配置环境变量

在 Supabase 项目中设置：
1. 打开 Supabase 项目设置
2. 导航到「Edge Functions」→「Secrets」
3. 设置以下变量：
   - `DOUBAO_API_KEY` = 您的 API 密钥
   - `DOUBAO_MODEL_ID` = 模型名称（如 `doubao-seed-1-8-251228`）

## 💡 代码实现

系统现在使用正确的豆包 API 格式：

```typescript
// 调用豆包 API
const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${DOUBAO_API_KEY}`,
  },
  body: JSON.stringify({
    model: DOUBAO_MODEL_ID || 'doubao-seed-1-8-251228',
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: '用户消息' },
          { type: 'input_image', image_url: '图片URL' } // 可选
        ]
      }
    ]
  })
});

const data = await response.json();
const aiResponse = data.output?.text;
```

## 🐛 故障排除

### 问题 1：认证失败

**错误信息**：
```
Authentication failed
```

**原因**：`DOUBAO_API_KEY` 未设置或错误  
**解决**：确认 API Key 的值正确，没有多余的空格

### 问题 2：模型不存在

**错误信息**：
```
The model xxx does not exist
```

**原因**：`DOUBAO_MODEL_ID` 设置错误  
**解决**：使用正确的模型名称，如 `doubao-seed-1-8-251228`

### 问题 3：返回空响应

**原因**：响应格式解析错误  
**解决**：检查代码中使用 `data.output?.text` 提取响应

## 📊 API 限制

| 限制类型 | 值 |
|---------|---|
| 单次请求最大 Token | 根据模型而定 |
| 并发请求数 | 根据套餐而定 |
| 图片大小限制 | 10MB |
| 支持的图片格式 | JPG, PNG, WEBP |

## 🔗 相关资源

- [豆包 API 官方文档](https://www.volcengine.com/docs/82379/1298454)
- [火山引擎控制台](https://console.volcengine.com/)
- [模型价格说明](https://www.volcengine.com/pricing)

## ✅ 配置检查清单

- [ ] `DOUBAO_API_KEY` 已正确设置（API 密钥）
- [ ] `DOUBAO_MODEL_ID` 已设置为模型名称（不是端点 ID）
- [ ] API Key 有足够的调用额度
- [ ] 在控制台确认模型可用
- [ ] 测试发送消息验证配置

---

**最后更新**：2026-01-22  
**API 版本**：v3  
**端点**：`https://ark.cn-beijing.volces.com/api/v3/responses`