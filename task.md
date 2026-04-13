## 核心任务：彻底重构 Feishu AST 展平解析引擎 (采用官方 `/descendant` 接口)

### 1. 架构升级红线
- **废弃接口**：严禁在插入内容时使用 `/children` 接口，它天然不支持嵌套，会引发 9499 错误。
- **启用官方嵌套接口**：必须将 Step 2 的 API 端点更改为：
  `POST /open-apis/docx/v1/documents/${document_id}/blocks/${document_id}/descendant`

### 2. 核心算法重构：AST 展平 (Flattening)
`/descendant` 接口的请求体必须是“展平”的。你必须在 `app/api/feishu/route.ts` 中编写一个 `flattenBlocks` 函数。
**数据结构规范如下（必须严格遵守）：**
1. 为前端传来的每个独立内容（含嵌套的单元格）生成唯一的临时 `block_id`（可以使用 `Math.random().toString(36).substr(2, 9)` 或类似机制）。
2. 构建平铺数组：所有生成的 Block 对象必须全部推进一个名为 `descendants` 的一维数组中。
3. 建立父子指针：对于表格这种容器节点，必须在父节点添加 `children: ["子节点id_1", "子节点id_2"]`，而子节点自身必须存在于 `descendants` 数组中。
4. **最终发给飞书的 payload 结构必须是：**
   ```javascript
   {
     "index": -1,
     "children_id": ["root_id_1", "root_id_2"], // 这里只存放最外层根节点的 ID
     "descendants": [ // 这里存放所有节点（包含父节点和子节点）的完整数据
        { "block_id": "root_id_1", "block_type": 2, "text": {...} },
        { "block_id": "root_id_2", "block_type": 31, "table": {...}, "children": ["cell_id_1"] },
        { "block_id": "cell_id_1", "block_type": 32, "table_cell": {}, "children": ["text_id_1"] },
        { "block_id": "text_id_1", "block_type": 2, "text": {...} }
     ]
   }

   3. 精准排版解析规范 (不妥协原则)
原生表格解析 (Markdown Table)：
遇到包含 | 的 Markdown 表格内容，必须解析为 table (31) -> table_cell (32) -> text (2) 的三层级关联。
极其重要：必须计算出准确的 row_size 和 column_size，且生成的 table_cell 数量必须等于 row_size * column_size，空单元格也要生成对应的空 table_cell 节点，否则飞书会拒绝接收！

极客风代码块兜底 (Code Block)：
遇到 Mermaid 流程图源码、Nano Banana 提示词（Prompt）、或是解析失败的异形内容，全部封装进 block_type: 14 (代码块) 中渲染，保留等宽字体和灰底的高级排版。

基础文本：Heading (3-11), Bullet (12), Quote (15) 等保持标准文本元素封装不变。

4. 强制拦截与打印
在请求发给飞书前，console.log 打印出 children_id.length 和 descendants.length 供调试。

必须保留 data.code !== 0 的严格报错拦截，将飞书的错误原因直接 throw 出去。

严禁改UI！