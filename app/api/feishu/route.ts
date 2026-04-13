import { NextRequest, NextResponse } from 'next/server';

// 飞书 API 基础 URL
const FEISHU_BASE_URL = 'https://open.feishu.cn/open-apis';

// 将JSON内容转换为飞书文档blocks
function convertToFeishuBlocks(content: any): any[] {
  // 处理null或undefined内容
  if (content == null) {
    return [normalizeBlock({ type: "text", content: "空内容" })];
  }

  // 如果content是字符串，转换为简单的段落
  if (typeof content === 'string') {
    return [normalizeBlock({ type: "text", content })];
  }

  // 如果content是数组，假设已经是blocks结构，但需要验证格式
  if (Array.isArray(content)) {
    // 过滤掉null/undefined元素
    return content.filter(block => block != null).map((block: any) => normalizeBlock(block));
  }

  // 如果content是对象，尝试转换为blocks
  if (typeof content === 'object') {
    // 检查是否有blocks字段
    if (content.blocks && Array.isArray(content.blocks)) {
      // 过滤掉null/undefined元素
      return content.blocks.filter(block => block != null).map((block: any) => normalizeBlock(block));
    }

    // 否则将整个对象作为JSON字符串显示
    return [normalizeBlock({ type: "text", content: JSON.stringify(content, null, 2) })];
  }

  // 默认情况
  return [normalizeBlock({ type: "text", content: String(content) })];
}

// 规范化block结构，确保符合飞书API要求
function normalizeBlock(block: any): any {
  // 如果block为null或undefined，返回默认段落
  if (block == null) {
    return {
      "block_type": 2,
      "text": {
        "elements": [
          {
            "text_run": {
              "content": "空内容"
            }
          }
        ]
      }
    };
  }

  // 如果block已经有正确的结构（有block_type字段），直接返回
  if (typeof block.block_type === 'number') {
    return block;
  }

  const content = block.text || block.content || '';
  // 飞书底层标准 text_run 结构
  const baseElements = [{ "text_run": { "content": content } }];

  const type = block?.type || 'text';
  switch (type) {
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

// 获取飞书访问令牌
async function getFeishuAccessToken(appId: string, appSecret: string): Promise<string> {
  try {
    console.log('获取飞书访问令牌，App ID:', appId != null ? `${String(appId).substring(0, 8)}...` : 'empty');

    const response = await fetch(`${FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('获取访问令牌失败 - 状态:', response.status, response.statusText, '响应:', errorText);

      let errorMessage = `获取访问令牌失败: ${response.status} ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.msg) {
          errorMessage += ` - ${errorJson.msg}`;
        }
        if (errorJson.code) {
          errorMessage += ` (错误码: ${errorJson.code})`;
        }
      } catch {
        // 如果不是JSON，使用原始文本
        if (errorText) {
          errorMessage += ` - ${errorText.substring(0, 200)}`;
        }
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('飞书令牌响应:', data);

    if (data.code !== 0) {
      throw new Error(`飞书 API 错误: ${data.msg}`);
    }

    return data.tenant_access_token;
  } catch (error) {
    console.error('获取飞书访问令牌错误堆栈:', error.stack || error);
    throw error;
  }
}

// 创建飞书文档
async function createFeishuDocument(accessToken: string, spaceId: string, title: string, content: any): Promise<any> {
  try {
    console.log('创建文档，空间ID:', spaceId, '标题:', title);

    // 转换内容为飞书blocks
    const elements = convertToFeishuBlocks(content);

    // 创建文档请求体（先创建空文档，不传入内容）
    const createPayload: any = {
      title: title,
      body: {
        locale: "zh_cn",
        elements: [] // 空内容，后续通过插入接口添加
      }
    };

    // 如果 spaceId 存在且非空，添加 folder_token
    if (spaceId && spaceId.trim() !== '') {
      createPayload.folder_token = spaceId;
    }

    console.log('Step 1 - 创建空文档 payload:', JSON.stringify(createPayload, null, 2));

    // 使用 docx.v1.document 接口创建文档
    const createResponse = await fetch(`${FEISHU_BASE_URL}/docx/v1/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(createPayload),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('创建文档失败 - 状态:', createResponse.status, createResponse.statusText, '响应:', errorText);

      let errorMessage = `创建文档失败: ${createResponse.status} ${createResponse.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.msg) {
          errorMessage += ` - ${errorJson.msg}`;
        }
        if (errorJson.code) {
          errorMessage += ` (错误码: ${errorJson.code})`;
        }
      } catch {
        // 如果不是JSON，使用原始文本
        if (errorText) {
          errorMessage += ` - ${errorText.substring(0, 200)}`;
        }
      }
      throw new Error(errorMessage);
    }

    const createData = await createResponse.json();
    console.log('Step 1 - 创建文档响应:', createData);

    if (createData.code !== 0) {
      throw new Error(`飞书 API 错误: ${createData.msg}`);
    }

    // 安全访问飞书API响应
    const document = createData?.data?.document;
    if (!document || !document.document_id) {
      console.error('飞书API响应缺少document或document_id:', createData);
      throw new Error('飞书API返回的数据格式不正确，缺少文档ID');
    }
    const documentId = document.document_id;
    const documentToken = document.document_id; // 注意：document_id 可能不是 token，但暂时使用

    console.log(`Step 2 - 准备插入 ${elements.length} 个 blocks 到文档 ${documentId}`);

    // Step 2: 批量插入 blocks 到文档
    // 飞书官方正确接口: POST /docx/v1/documents/{documentId}/blocks/{blockId}/children
    // 文档的根 block ID 就是 documentId 本身
    const blockId = documentId; // 文档根节点
    const insertPayload = {
      children: elements
    };

    console.log('Step 2 - 插入 blocks payload:', JSON.stringify(insertPayload, null, 2));

    const insertRes = await fetch(`${FEISHU_BASE_URL}/docx/v1/documents/${documentId}/blocks/${blockId}/children`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(insertPayload),
    });

    if (!insertRes.ok) {
      const errorText = await insertRes.text();
      console.error('插入 blocks 失败 - 状态:', insertRes.status, insertRes.statusText, '响应:', errorText);

      let errorMessage = `插入 blocks 失败: ${insertRes.status} ${insertRes.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.msg) {
          errorMessage += ` - ${errorJson.msg}`;
        }
        if (errorJson.code) {
          errorMessage += ` (错误码: ${errorJson.code})`;
        }
      } catch {
        // 如果不是JSON，使用原始文本
        if (errorText) {
          errorMessage += ` - ${errorText.substring(0, 200)}`;
        }
      }
      throw new Error(errorMessage);
    }

    const insertData = await insertRes.json();
    console.log('Step 2 - 插入 blocks 响应:', insertData);

    // 严格的 error.code !== 0 拦截（根据用户要求）
    if (insertData.code !== 0) {
      throw new Error(`【飞书 API 拒绝插入内容】错误码: ${insertData.code}, 原因: ${insertData.msg}`);
    }

    return {
      success: true,
      documentId: documentId,
      documentToken: documentToken,
      documentUrl: `https://your-workspace.feishu.cn/docx/${documentId}`,
      message: '文档创建并插入内容成功'
    };
  } catch (error) {
    console.error('创建飞书文档错误堆栈:', error.stack || error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json();
    const { appId, appSecret, title, blocks, folderToken, folder_token, spaceId: spaceIdFromBody } = body;

    // 安全计算 blocks 信息
    let blocksInfo = 'null或undefined';
    let blocksLength = 0;
    if (blocks != null) {
      if (Array.isArray(blocks)) {
        blocksLength = blocks.length;
        blocksInfo = `数组，长度: ${blocksLength}`;
      } else {
        blocksInfo = `非数组类型: ${typeof blocks}`;
      }
    }

    console.log('API 请求接收:', {
      appId: appId != null ? `${String(appId).substring(0, 8)}...` : 'empty',
      appSecret: appSecret ? '***' : 'empty',
      title: title != null ? `${String(title).substring(0, 50)}...` : '空',
      blocks: blocksInfo,
      hasFolderToken: folderToken != null,
      hasFolder_token: folder_token != null,
      hasSpaceId: spaceIdFromBody != null
    });

    // 验证必要参数
    const missingParams: string[] = [];
    if (!appId) missingParams.push('appId');
    if (!appSecret) missingParams.push('appSecret');
    if (!title) missingParams.push('title');
    if (!blocks) missingParams.push('blocks');

    if (missingParams.length > 0) {
      console.log('缺少必要参数:', missingParams);
      const errorMessage = `缺少必要参数: ${missingParams.join(', ')}`;
      return NextResponse.json(
        {
          error: errorMessage,
          details: {
            appId: !!appId,
            appSecret: !!appSecret,
            title: !!title,
            blocks: !!blocks,
            folderToken: !!folderToken,
            folder_token: !!folder_token,
            spaceId: !!spaceIdFromBody
          }
        },
        { status: 400 }
      );
    }

    // 设置文档标题和内容
    const finalTitle = title || '未命名文档';
    const content = blocks || [];

    // 记录处理结果
    console.log('文档数据准备:', {
      title: finalTitle,
      blocksType: typeof blocks,
      isArray: Array.isArray(blocks),
      blocksLength: Array.isArray(blocks) ? blocks.length : '非数组'
    });

    // 获取飞书访问令牌
    const accessToken = await getFeishuAccessToken(appId, appSecret);

    // 获取空间ID（优先使用 folderToken，然后 folder_token，然后 spaceId，如果没有有效值则不设置）
    let spaceId = ''; // 默认不设置文件夹，让飞书创建在根目录
    let source = 'none';

    if (folderToken != null && String(folderToken).trim() !== '') {
      spaceId = String(folderToken).trim();
      source = 'folderToken';
    } else if (folder_token != null && String(folder_token).trim() !== '') {
      spaceId = String(folder_token).trim();
      source = 'folder_token';
    } else if (spaceIdFromBody != null && String(spaceIdFromBody).trim() !== '') {
      spaceId = String(spaceIdFromBody).trim();
      source = 'spaceId';
    }

    console.log(`使用 ${source} 作为空间ID:`, spaceId?.substring?.(0, 20) + (spaceId?.length > 20 ? '...' : ''));

    // 创建文档
    const result = await createFeishuDocument(accessToken, spaceId, finalTitle, content);

    return NextResponse.json({
      success: true,
      message: '文档创建成功',
      data: result
    });

  } catch (error: any) {
    // 1. 在终端打印最详细的错误，方便本地排查
    console.error("【后端致命错误堆栈】:", error.stack || error.response?.data || error.message || error);

    // 2. 将真实的错误信息打包，以 400 状态码退回给前端
    const errorMsg = error.response?.data?.msg || error.message || "未知后端错误";
    return NextResponse.json({
      success: false,
      error: `飞书接口拒绝访问: ${errorMsg}`
    }, { status: 400 });
  }
}

// GET 请求处理：健康检查
export async function GET() {
  return NextResponse.json({
    service: 'Feishu API Service',
    status: 'active',
    endpoints: ['POST /api/feishu'],
    description: '飞书文档创建 API'
  });
}