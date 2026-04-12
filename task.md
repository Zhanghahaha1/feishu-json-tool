## 核心任务
将 `reference_ui.txt` 转化为 Next.js 页面，并对接飞书 API。

## 硬性约束
1. **UI 锁定**：必须 100% 还原 reference_ui.txt 的布局。禁止添加任何输入框（如 Space ID）。
2. **API 规范**：后端接口只能使用 docx.v1.document 路径。
3. **保留文件**：任务完成后，禁止删除 reference_ui.txt 和 task.md。

## 执行步骤
1. 覆盖 app/page.tsx。
2. 重写 app/api/feishu/route.ts（使用我给你的那段标准代码）。
3. 安装必要依赖（axios, lucide-react）。