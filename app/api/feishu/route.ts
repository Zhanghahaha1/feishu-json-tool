import { NextRequest, NextResponse } from 'next/server';

const FEISHU_BASE_URL = 'https://open.feishu.cn/open-apis';

// =====================================================================
// 1. 底层核心：飞书官方严格要求的 AST 展平处理逻辑
// =====================================================================

function generateId() {
  return 'id_' + Math.random().toString(36).substr(2, 9);
}

// 核心解析器：将前端数据转化为飞书 /descendant 接口所需的纯净展平结构
function buildFlatAST(frontendBlocks: any[]) {
  const descendantsArray: any[] = [];
  const rootIds: string[] = [];

  const blocks = Array.isArray(frontendBlocks) ? frontendBlocks : [frontendBlocks];

  for (const block of blocks) {
    if (!block) continue;

    const type = block.type || 'text';
    // 强制提取纯文本，防止传入对象导致飞书解析崩溃
    const content = typeof (block.text || block.content) === 'string' 
      ? (block.text || block.content) 
      : JSON.stringify(block.text || block.content || block);

    const currentId = generateId();

    // -------------------------------------------------------------
    // 模块 A：深度解析 Markdown 表格为飞书原生表格
    // -------------------------------------------------------------
    if ((type === 'markdown' || content.includes('|---|') || content.includes('| --- |')) && content.includes('|')) {
      const lines = content.trim().split('\n');
      // 过滤掉表格的分割线
      const rows = lines.filter(line => line.includes('|') && !line.includes('|---|') && !line.includes('| --- |'));

      if (rows.length > 0) {
        const row_size = rows.length;
        // 精确计算列数
        const column_size = Math.max(...rows.map(row => row.split('|').filter(c => c.trim() !== '').length));

        if (column_size > 0) {
          const tableCellIds = [];
          rootIds.push(currentId);

          rows.forEach(row => {
            const cells = row.split('|').filter(c => c.trim() !== '');
            for (let i = 0; i < column_size; i++) {
              // 飞书不允许完全为空的 text_run，遇到空单元格兜底填充一个空格
              const cellContent = (cells[i] ? cells[i].trim() : '') || ' '; 
              const cellId = generateId();
              const textId = generateId();

              tableCellIds.push(cellId);

              // 1. 最底层的文本节点
              descendantsArray.push({
                block_id: textId,
                block_type: 2,
                text: { elements: [{ text_run: { content: cellContent } }] }
              });

              // 2. 中间的单元格节点 (⚠️ 极其关键：children 只能放纯字符串 ID 数组)
              descendantsArray.push({
                block_id: cellId,
                block_type: 32,
                table_cell: {},
                children: [textId]
              });
            }
          });

          // 3. 最外层的表格根节点
          descendantsArray.push({
            block_id: currentId,
            block_type: 31,
            table: { property: { row_size: row_size, column_size: column_size } },
            children: tableCellIds
          });
          
          continue; // 表格处理完毕，跳入下一个循环
        }
      }
    }

    // -------------------------------------------------------------
    // 模块 B：优雅降级 - 处理 Mermaid 流程图与 Nano Banana 提示词
    // -------------------------------------------------------------
    if (content.includes('nano_banana') || content.includes('Prompt:') || content.includes('<lora:') || content.includes('graph TD') || content.includes('mermaid')) {
      rootIds.push(currentId);
      descendantsArray.push({
        block_id: currentId,
        block_type: 14,
        code: {
          elements: [{ text_run: { content: content } }],
          style: { wrap: true }
        }
      });
      continue;
    }

    // -------------------------------------------------------------
    // 模块 C：基础文本排版映射 (纯粹且安全)
    // -------------------------------------------------------------
    rootIds.push(currentId);
    let targetBlockType = 2;
    let targetKey = "text";

    if (type === 'heading1' || type === 'h1') { targetBlockType = 3; targetKey = "heading1"; }
    else if (type === 'heading2' || type === 'h2') { targetBlockType = 4; targetKey = "heading2"; }
    else if (type === 'heading3' || type === 'h3') { targetBlockType = 5; targetKey = "heading3"; }
    else if (type === 'bullet') { targetBlockType = 12; targetKey = "bullet"; }
    else if (type === 'quote') { targetBlockType = 15; targetKey = "quote"; }

    descendantsArray.push({
      block_id: currentId,
      block_type: targetBlockType,
      [targetKey]: { elements: [{ text_run: { content: content } }] }
    });
  }

  return { rootIds, descendantsArray };
}


// =====================================================================
// 2. 飞书接口请求与鉴权核心逻辑
// =====================================================================

async function getFeishuAccessToken(appId: string, appSecret: string): Promise<string> {
  const response = await fetch(`${FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });

  const data = await response.json();
  if (data.code !== 0) throw new Error(`获取 Token 失败: ${data.msg}`);
  return data.tenant_access_token;
}

async function createFeishuDocument(accessToken: string, spaceId: string, title: string, content: any): Promise<any> {
  // Step 1: 创建空文档
  const createPayload: any = {
    title: title,
    body: { locale: "zh_cn", elements: [] }
  };
  if (spaceId && spaceId.trim() !== '') createPayload.folder_token = spaceId;

  const createResponse = await fetch(`${FEISHU_BASE_URL}/docx/v1/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(createPayload),
  });

  const createData = await createResponse.json();
  if (createData.code !== 0) throw new Error(`创建文档失败: ${createData.msg}`);
  
  const documentId = createData.data.document.document_id;

  // Step 2: 展平数据结构并调用 /descendant 接口插入内容
  const { rootIds, descendantsArray } = buildFlatAST(content);
  
  console.log('>>> 发往飞书的 payload 节点数:', { 根节点: rootIds.length, 总节点: descendantsArray.length });

  const insertRes = await fetch(`${FEISHU_BASE_URL}/docx/v1/documents/${documentId}/blocks/${documentId}/descendant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      index: -1,
      children_id: rootIds,
      descendants: descendantsArray
    }),
  });

  const insertData = await insertRes.json();
  
  if (insertData.code !== 0) {
    throw new Error(`【飞书拒收格式】错误码: ${insertData.code}, 原因: ${insertData.msg}`);
  }

  return {
    success: true,
    documentId: documentId,
    documentUrl: `https://feishu.cn/docx/${documentId}`, // 这里可以替换成你们公司的具体域名
    message: '文档创建并排版成功'
  };
}

// =====================================================================
// 3. Next.js 路由处理逻辑
// =====================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId, appSecret, title, blocks, folderToken, folder_token, spaceId: spaceIdFromBody } = body;

    if (!appId || !appSecret || !title || !blocks) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    const finalTitle = title || '未命名文档';
    let spaceId = '';
    if (folderToken) spaceId = String(folderToken).trim();
    else if (folder_token) spaceId = String(folder_token).trim();
    else if (spaceIdFromBody) spaceId = String(spaceIdFromBody).trim();

    const accessToken = await getFeishuAccessToken(appId, appSecret);
    const result = await createFeishuDocument(accessToken, spaceId, finalTitle, blocks);

    return NextResponse.json({
      success: true,
      message: '文档创建成功',
      data: result
    });

  } catch (error: any) {
    console.error("【后端致命错误】:", error);
    const errorMsg = error.response?.data?.msg || error.message || "未知后端错误";
    return NextResponse.json({
      success: false,
      error: `API 拒绝访问: ${errorMsg}`
    }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'active', description: '飞书文档创建 API' });
}