# Feishu JSON Tool

JSON代码一键转为飞书文档

![GitHub Actions](https://github.com/Zhanghahaha1/feishu-json-tool/actions/workflows/ci.yml/badge.svg)
![GitHub Actions](https://github.com/Zhanghahaha1/feishu-json-tool/actions/workflows/deploy.yml/badge.svg)

一个强大的工具，将 JSON 数据结构智能转换为飞书文档，支持 Markdown 表格、Mermaid 图表、Nano Banana 提示词等复杂格式的优雅渲染。

## ✨ 核心特性

### 🔥 AST 展平算法
- 采用飞书官方 `/descendant` 接口，解决 9499 嵌套表格错误
- 智能解析 Markdown 表格为飞书原生表格结构
- 递归展平任意深度嵌套，确保飞书 API 兼容性

### 📊 智能格式识别
- **Markdown 表格** → 飞书原生表格 (block_type: 31)
- **Mermaid 图表** → 代码块 (block_type: 14)
- **Nano Banana 提示词** → 代码块 (block_type: 14)
- **标题/引用/列表** → 对应飞书排版元素

### 🚀 一键部署
- GitHub Actions 自动构建和测试
- 可选 Vercel 一键部署
- 完整的 CI/CD 流水线

## 🛠️ 技术栈

- **前端**: Next.js 14, React 19, TypeScript, Tailwind CSS
- **后端**: Next.js API Routes, 飞书 OpenAPI
- **构建**: GitHub Actions, Vercel CLI

## 🚀 快速开始

### 1. 本地开发
```bash
# 克隆项目
git clone https://github.com/Zhanghahaha1/feishu-json-tool.git
cd feishu-json-tool

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 2. 环境配置
在项目根目录创建 `.env.local` 文件：
```env
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
```

### 3. 飞书应用配置
1. 登录 [飞书开放平台](https://open.feishu.cn/app)
2. 创建企业自建应用
3. 获取 App ID 和 App Secret
4. 为应用添加以下权限：
   - `docx:document:readonly`
   - `docx:document:write`
   - `docx:block:readonly`
   - `docx:block:write`

## 📁 项目结构
```
├── app/
│   ├── api/feishu/          # 飞书 API 路由
│   │   └── route.ts         # AST 展平核心算法
│   ├── components/          # React 组件
│   ├── page.tsx            # 主页面
│   └── globals.css         # 全局样式
├── .github/workflows/      # GitHub Actions
│   ├── ci.yml              # CI/CD 流水线
│   └── deploy.yml          # Vercel 部署
└── public/                 # 静态资源
```

## 🔧 API 接口

### POST `/api/feishu`
将 JSON 内容转换为飞书文档。

**请求体:**
```json
{
  "appId": "飞书应用ID",
  "appSecret": "飞书应用密钥",
  "title": "文档标题",
  "blocks": [
    {
      "type": "text",
      "content": "这是一段文本"
    },
    {
      "type": "markdown",
      "content": "| 姓名 | 年龄 |\n|------|------|\n| 张三 | 25   |"
    }
  ]
}
```

**响应:**
```json
{
  "success": true,
  "documentId": "文档ID",
  "documentUrl": "https://feishu.cn/docx/文档ID"
}
```

## ⚙️ GitHub Actions

项目配置了两个 GitHub Actions 工作流：

### 1. CI/CD Pipeline (`.github/workflows/ci.yml`)
- 在推送到 `main` 分支或创建 PR 时运行
- 自动安装依赖、构建项目
- 确保代码质量和构建成功

### 2. Vercel 部署 (`.github/workflows/deploy.yml`)
- 在推送到 `main` 分支时运行
- 需要配置以下 GitHub Secrets：
  - `VERCEL_TOKEN`: Vercel 访问令牌
  - `VERCEL_PROJECT_ID`: Vercel 项目 ID
  - `VERCEL_ORG_ID`: Vercel 组织 ID

## 🧪 开发指南

### 添加新的内容类型
在 `app/api/feishu/route.ts` 中的 `buildFlatAST` 函数添加新的格式处理逻辑。

### 调试飞书 API
1. 查看浏览器控制台网络请求
2. 检查飞书 API 响应状态码
3. 使用 `console.log` 输出展平后的数据结构

### 测试表格解析
```json
{
  "type": "markdown",
  "content": "| 功能 | 状态 |\n|------|------|\n| 表格解析 | ✅ |\n| 代码块 | ✅ |\n| 嵌套支持 | ✅ |"
}
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📞 支持

- 提交 [Issue](https://github.com/Zhanghahaha1/feishu-json-tool/issues)
- 查看 [GitHub Actions](https://github.com/Zhanghahaha1/feishu-json-tool/actions)

---

**一键将 JSON 转换为专业的飞书文档，让技术文档创作变得简单高效！**