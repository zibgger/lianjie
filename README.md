# AI 个人简历 → 个人主页生成器（Vercel 修复版）

这是专门为 Vercel Serverless Runtime 改造的版本。

## 与旧版本的主要区别

- 使用 `api/index.js` 作为 Vercel Function，不再直接把 `server.js` 当作常驻 Express 服务器。
- 浏览器直接以 `application/pdf` 二进制请求发送 PDF，避免在 Vercel 上使用 `multer.diskStorage` 写本地磁盘。
- PDF 最大 4 MB，避免 Vercel Function 请求体超限。
- 使用 OpenAI Responses API 读取 PDF 并提取结构化简历信息。
- 使用 Vercel Blob 保存生成后的 HTML，因此生成的主页有真正可分享的 URL。
- 不把 OpenAI API Key 放到前端。
- 默认模型为 `gpt-5.6`，也可以通过 `OPENAI_MODEL` 环境变量覆盖。

## Vercel 环境变量

必须有：

`OPENAI_API_KEY`

另外必须连接一个 Vercel Blob Store，连接后 Vercel 会提供：

`BLOB_READ_WRITE_TOKEN`

可选：

`OPENAI_MODEL=gpt-5.6`

## 部署步骤

1. 把本项目根目录的全部文件上传到 GitHub。
2. 在 Vercel 导入 GitHub 仓库。
3. 保持 Root Directory 为 `./`。
4. 不需要把 `server.js` 当作入口。
5. 在 Vercel 项目中创建 Blob Store 并连接当前项目。
6. 确认 `OPENAI_API_KEY` 和 `BLOB_READ_WRITE_TOKEN` 已存在。
7. 重新 Deploy。
8. 打开网站首页，上传 PDF 测试。

## 本地运行

本项目的核心部署入口是 Vercel Function。
如需本地测试，可使用 Vercel CLI：

`npm install -g vercel`

然后：

`vercel dev`

## 安全

- 不要把真实 `.env` 上传 GitHub。
- 不要把 `OPENAI_API_KEY` 写进前端 HTML/JS。
- 不要把 API Key 发到聊天、截图或公开仓库。
- 用户上传的 PDF 会被发送给 OpenAI API 处理。
