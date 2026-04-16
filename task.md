## 核心任务：实现创建后自动赋权，彻底解决用户无法编辑的问题

### 1. 业务逻辑变更 (必须执行)
- **放弃手动模式**：不再强求用户提供 `folderToken`。如果提供了则使用，如果不提供，文档将创建在机器人根目录，但必须通过 API 自动将当前用户设为管理员。
- **获取当前用户**：为了精准赋权，我们需要用户的 `email` 或 `open_id`。
  *(考虑到 MVP 易用性：请在后端逻辑中增加一个变量 `ADMIN_EMAIL`，暂时由用户在前端设置中填写自己的飞书邮箱)*

### 2. 后端重构要求 (app/api/feishu/route.ts)
在文档插入内容 (`/descendant`) 成功后，立即增加一个 Step 3：

- **API 动作**：调用飞书权限更新接口：
  `POST /open-apis/drive/v1/permissions/${document_id}/members?type=docx`
- **请求参数**：
  ```json
  {
    "member_type": "email",
    "member_id": "${ADMIN_EMAIL}",
    "perm": "full_access" // 赋予最高权限：管理者
  }

  关键点：必须确保这个请求在文档创建成功后立即执行。即使赋权失败，也不要影响文档链接的返回，但在日志里记录失败原因。

3. 前端交互优化 (app/page.tsx)
UI 调整：将之前的“保存位置(Folder Token)”输入框改为“你的飞书邮箱 (用于自动获取编辑权限)”。

本地记忆：同样使用 localStorage 记住这个邮箱，默认保留上次填写的。

说明文字：提示用户：“填入你的飞书账号邮箱，生成后你将自动获得该文档的编辑权限。”

4. 严谨性要求
不准改坏解析引擎：之前的 AST 展平算法（Table/CodeBlock）已经完美，严禁触碰那部分逻辑！

只允许新增：在 createFeishuDocument 函数的末尾增加赋权逻辑。