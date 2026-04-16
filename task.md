核心任务：紧急修复 app/page.tsx 的断头代码与水合错误 (Hydration Error)

背景诊断：由于上一次任务因上下文超限中断，app/page.tsx 目前处于代码残缺状态。同时，设置弹窗触发了 Next.js 的 Hydration 错误（由于在 SSR 阶段直接使用了本地存储状态）。

UI 修复 (严格对齐设计)：

彻底移除邮箱输入相关逻辑。

在设置弹窗中，只保留 “飞书绑定手机号 (Phone Number)” 的输入框。

恢复 app/page.tsx 的完整结构，确保没有任何未闭合的标签或截断的函数。

修复水合错误 (必做)：

在 app/page.tsx 中引入 mounted 状态。

使用 useEffect 在组件挂载后将 mounted 设为 true。

只有当 mounted 为 true 时，才允许渲染包含 localStorage 数据的设置面板或表单项。这能彻底解决 image_a43428.png 中的报错。

后端连接性：确保后端 app/api/feishu/route.ts 依然能够正确接收前端传来的 phoneNumber。

部署保底：

检查并确保 next.config.ts 中的 ignoreBuildErrors: true 依然存在，确保能绕过 Vercel 报错。

红线要求：

禁止触碰 任何关于 Markdown 表格解析、AST 展平或飞书文档插入的业务逻辑代码！