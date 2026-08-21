# AI 个人简历 → 个人主页链接生成器

这是一个全新的 Node.js + Express + OpenAI API 示例项目。

## 功能

1. 浏览器上传 PDF 简历。
2. 后端接收 PDF，不把 API Key 暴露给前端。
3. 后端将 PDF 上传到 OpenAI Files API。
4. 使用 Responses API 读取 PDF，并让 AI 输出结构化简历 JSON。
5. 服务器根据 JSON 自动生成独立 HTML。
6. 返回：
   `http://localhost:3000/sites/your-slug/`

## 运行

```bash
npm install
copy .env.example .env
```

Windows PowerShell:
```powershell
$env:OPENAI_API_KEY="你的API Key"
npm start
```

或者把 key 写入 `.env`：

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.6-luna
PORT=3000
PUBLIC_BASE_URL=http://localhost:3000
```

然后：

```bash
npm start
```

打开：

http://localhost:3000

## 重要：为什么不能只用 GitHub Pages？

GitHub Pages 是静态托管，不能安全地在浏览器里保存 OpenAI API Key，也不能直接执行 Node.js 后端。

因此真正上线时建议：

浏览器
→ 前端上传 PDF
→ Node.js / Vercel / Cloudflare Worker 后端
→ OpenAI API
→ 数据库 / 对象存储
→ 生成页面
→ 返回公开 URL

如果要做到永久链接，可以把生成的 HTML 上传到：
- Vercel / Netlify
- Cloudflare R2 + Workers
- S3 / OSS
- GitHub Pages（需要 GitHub API / GitHub App）

本项目默认使用服务器本地 `public/sites` 生成链接，适合本地开发和传统 VPS；部署到无状态 Serverless 时，需要把这一部分换成对象存储或 GitHub API。

## PDF 与隐私

代码使用 OpenAI Files API 的 `purpose=user_data`，并设置 24 小时过期，同时在生成完成后主动删除上传文件。

生产环境仍建议：
- 登录与用户隔离
- 上传大小限制
- MIME/文件内容验证
- 病毒扫描
- 速率限制
- 数据库记录
- 对象存储
- 删除机制
- 日志脱敏
