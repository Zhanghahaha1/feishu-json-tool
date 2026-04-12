## 核心任务：从 v0-reference 物理还原 UI 且 严禁使用模拟逻辑

### 1. 样式系统强制覆盖
- **必须读取**：`v0-reference/styles/globals.css` -> **全量覆盖**到 `app/globals.css`。
- **必须读取**：`v0-reference/tailwind.config.mjs` -> **全量覆盖**内容到 `tailwind.config.ts`。
- **注意**：不要说找不到文件，文件就在 v0-reference 文件夹里。

### 2. UI 与 真实逻辑 还原
- **必须读取**：`v0-reference/app/page.tsx` -> **覆盖**到 `app/page.tsx`。
- **逻辑锁死**：覆盖后，检查 `handleSubmit` 函数。**严禁使用任何 Mock（模拟）代码**。必须确保它在调用 `fetch('/api/feishu', ...)`。

### 3. 禁令
- **严禁改名**：绝对不准修改 `v0-reference` 文件夹的名字。
- **严禁发挥**：除了还原 UI，不要添加任何你觉得“好”的功能（如空间 ID）。

### 4. 执行
- 完成后运行 `npm run dev`。