## 核心任务：实现输入状态持久化并修复文件夹报错

### 1. 前端：输入状态持久化，防止刷新清空 (app/page.tsx)
- **现状体验极差**：用户一旦刷新网页（F5），之前填入的 App ID 和 App Secret 就会从输入框中消失。
- **强制修复**：
  - 在前端组件中引入 `useEffect`。
  - 在组件初次加载时（`[]` 依赖），立即从 `localStorage.getItem('feishu_creds')` 中读取保存的数据。
  - 将读取到的 `appId`、`appSecret`、`folderToken` 自动注入到对应的 State 中（如 `setAppId`），让输入框在刷新后依然保留用户上次填写的内容。

### 2. 后端：剥离无效的 folderToken (app/api/feishu/route.ts)
- **致命 Bug 定位**：飞书报 `400 folder not found (1770039)`，是因为前端传了空字符串或无效的 `folderToken`，而后端直接将其带入了发给飞书的 payload 中。
- **强制修复**：
  - 在组装调用飞书“创建文档 API”的请求体（Request Body / Payload）时，必须进行动态判断。
  - **只有当 `folderToken` 存在且不为空字符串时**，才向请求体中加入 `folder_token` 字段。
  - 如果 `folderToken` 为空，**绝对不要**在请求体中携带 `folder_token` 字段（让飞书默认创建在应用的根目录下）。

### 3. 禁止事项
- 严禁修改现有的 UI 样式和 JSON 到 Block 的转换核心逻辑。