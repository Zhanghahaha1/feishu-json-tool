## 核心任务：构建完美的富文本映射引擎并修复“假成功”漏洞

### 1. 致命 Bug：掩盖 Step 2 报错
- **现状**：Step 2 (批量插入 Blocks) 调用飞书 `/children` 接口时，由于结构不符合飞书要求，飞书实际上返回了错误。但后端代码忽略了该错误，直接给前端返回了成功，导致生成了大量只有标题的空文档！
- **强制修复**：在 Step 2 的 fetch 响应后，**必须**加入以下严格的校验代码：
  ```javascript
  const insertData = await insertRes.json();
  if (insertData.code !== 0) {
    throw new Error(`【飞书 API 拒绝插入内容】错误码: ${insertData.code}, 原因: ${insertData.msg}`);
  }

  2. 完美富文本映射 (禁止降级！)
必须重写 normalizeBlock 函数，严格按照飞书官方格式输出，保留所有排版，绝不降级为纯文本。

请直接复制并使用以下 normalizeBlock 逻辑（我已经为你写好了最标准的飞书 AST 字典）：
function normalizeBlock(block) {
  const content = block.text || block.content || '';
  // 飞书底层标准 text_run 结构
  const baseElements = [{ "text_run": { "content": content } }];

  switch (block.type) {
    case 'heading1':
    case 'h1':
      return { "block_type": 3, "heading1": { "elements": baseElements } };
    case 'heading2':
    case 'h2':
      return { "block_type": 4, "heading2": { "elements": baseElements } };
    case 'heading3':
    case 'h3':
      return { "block_type": 5, "heading3": { "elements": baseElements } };
    case 'bullet':
      return { "block_type": 12, "bullet": { "elements": baseElements } };
    case 'quote':
      return { "block_type": 15, "quote": { "elements": baseElements } };
    case 'code':
      return { "block_type": 14, "code": { "elements": baseElements } };
    case 'text':
    case 'paragraph':
    default:
      // 未知格式兜底为正文，但内容绝不丢失
      return { "block_type": 2, "text": { "elements": baseElements } };
  }
}

3. 禁止事项
严禁忽略飞书的内部 code 报错。

严禁修改前端 app/page.tsx。
