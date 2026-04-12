import { NextRequest, NextResponse } from 'next/server';

// 飞书 API 基础 URL
const FEISHU_BASE_URL = 'https://open.feishu.cn/open-apis';

// 将JSON内容转换为飞书文档blocks
function convertToFeishuBlocks(content: any): any[] {
  // 如果content是字符串，转换为简单的段落
  if (typeof content === 'string') {
    return [
      {
        "type": "paragraph",
        "paragraph": {
          "elements": [
            {
              "type": "textRun",
              "textRun": {
                "content": content
              }
            }
          ]
        }
      }
    ];
  }

  // 如果content是数组，假设已经是blocks结构，但需要验证格式
  if (Array.isArray(content)) {
    return content.map((block: any) => normalizeBlock(block));
  }

  // 如果content是对象，尝试转换为blocks
  if (typeof content === 'object' && content !== null) {
    // 检查是否有blocks字段
    if (content.blocks && Array.isArray(content.blocks)) {
      return content.blocks.map((block: any) => normalizeBlock(block));
    }

    // 否则将整个对象作为JSON字符串显示
    return [
      {
        "type": "paragraph",
        "paragraph": {
          "elements": [
            {
              "type": "textRun",
              "textRun": {
                "content": JSON.stringify(content, null, 2)
              }
            }
          ]
        }
      }
    ];
  }

  // 默认情况
  return [
    {
      "type": "paragraph",
      "paragraph": {
        "elements": [
          {
            "type": "textRun",
            "textRun": {
              "content": String(content)
            }
          }
        ]
      }
    }
  ];
}

// 规范化block结构，确保符合飞书API要求
function normalizeBlock(block: any): any {
  // 如果block已经有正确的结构，直接返回
  if (block.type && (block.paragraph || block.bullet || block.quote || block.heading || block.code || block.todo || block.image || block.link || block.divider || block.file || block.grid || block.table || block.embedded_page || block.iframe || block.sheet || block.bitable || block.diagram || block.jira || block.mindnote || block.poll || block.slides || block.widget)) {
    return block;
  }

  // 根据type字段规范化block
  const type = block.type || 'paragraph';
  const text = block.text || block.content || JSON.stringify(block, null, 2);

  switch (type.toLowerCase()) {
    case 'paragraph':
      return {
        "type": "paragraph",
        "paragraph": {
          "elements": [
            {
              "type": "textRun",
              "textRun": {
                "content": text
              }
            }
          ]
        }
      };

    case 'bullet':
    case 'bullet_list':
    case 'unordered_list':
      return {
        "type": "bullet",
        "bullet": {
          "elements": [
            {
              "type": "textRun",
              "textRun": {
                "content": text
              }
            }
          ]
        }
      };

    case 'quote':
    case 'blockquote':
      return {
        "type": "quote",
        "quote": {
          "elements": [
            {
              "type": "textRun",
              "textRun": {
                "content": text
              }
            }
          ]
        }
      };

    case 'heading':
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'heading4':
    case 'heading5':
    case 'heading6':
      let level = 1;
      if (type.startsWith('h') && type.length === 2) {
        level = parseInt(type[1]);
      } else if (type.startsWith('heading') && type.length === 8) {
        level = parseInt(type[7]);
      }
      return {
        "type": "heading",
        "heading": {
          "level": level,
          "elements": [
            {
              "type": "textRun",
              "textRun": {
                "content": text
              }
            }
          ]
        }
      };

    case 'text':
      // text类型映射到paragraph
      return {
        "type": "paragraph",
        "paragraph": {
          "elements": [
            {
              "type": "textRun",
              "textRun": {
                "content": text
              }
            }
          ]
        }
      };

    default:
      // 默认作为段落处理
      return {
        "type": "paragraph",
        "paragraph": {
          "elements": [
            {
              "type": "textRun",
              "textRun": {
                "content": text
              }
            }
          ]
        }
      };
  }
}

// 获取飞书访问令牌
async function getFeishuAccessToken(appId: string, appSecret: string): Promise<string> {
  try {
    console.log('获取飞书访问令牌，App ID:', appId ? `${appId.substring(0, 8)}...` : 'empty');

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
    console.error('获取飞书访问令牌错误:', error);
    throw error;
  }
}

// 创建飞书文档
async function createFeishuDocument(accessToken: string, spaceId: string, title: string, content: any): Promise<any> {
  try {
    console.log('创建文档，空间ID:', spaceId, '标题:', title);

    // 转换内容为飞书blocks
    const elements = convertToFeishuBlocks(content);

    // 创建文档请求体
    const createPayload: any = {
      title: title,
      body: {
        locale: "zh_cn",
        elements: elements
      }
    };

    // 如果 spaceId 存在且非空，添加 folder_token
    if (spaceId && spaceId.trim() !== '') {
      createPayload.folder_token = spaceId;
    }

    console.log('发送给飞书的payload:', JSON.stringify(createPayload, null, 2));

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
    console.log('创建文档响应:', createData);

    if (createData.code !== 0) {
      throw new Error(`飞书 API 错误: ${createData.msg}`);
    }

    const documentId = createData.data.document.document_id;
    const documentToken = createData.data.document.document_id; // 注意：document_id 可能不是 token，但暂时使用

    return {
      success: true,
      documentId: documentId,
      documentToken: documentToken,
      documentUrl: `https://your-workspace.feishu.cn/docx/${documentId}`,
      message: '文档创建成功'
    };
  } catch (error) {
    console.error('创建飞书文档错误:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json();
    const { appId, appSecret, jsonData } = body;

    console.log('API 请求接收:', {
      appId: appId ? `${appId.substring(0, 8)}...` : 'empty',
      appSecret: appSecret ? '***' : 'empty',
      jsonDataLength: typeof jsonData === 'string' ? jsonData.length : JSON.stringify(jsonData).length
    });

    // 验证必要参数
    if (!appId || !appSecret || !jsonData) {
      console.log('缺少参数:', { appId: !!appId, appSecret: !!appSecret, jsonData: !!jsonData });
      return NextResponse.json(
        {
          error: '缺少必要参数',
          details: { appId: !!appId, appSecret: !!appSecret, jsonData: !!jsonData }
        },
        { status: 400 }
      );
    }

    // 解析 JSON 数据
    let title = '未命名文档';
    let content: any = '';

    try {
      const parsedJson = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

      // 支持多种JSON格式
      // 1. 标准格式: { "title": "...", "content": "..." }
      // 2. 飞书blocks格式: { "feishu_doc_title": "...", "blocks": [...] }
      // 3. 其他格式: 整个JSON作为内容

      if (parsedJson.feishu_doc_title) {
        title = parsedJson.feishu_doc_title;
        content = parsedJson.blocks || [];
      } else if (parsedJson.title) {
        title = parsedJson.title;
        content = parsedJson.content || '';
      } else {
        // 没有title字段，使用整个JSON作为内容
        title = '未命名文档';
        content = parsedJson;
      }

      console.log('JSON 解析成功:', {
        title,
        contentType: typeof content,
        isArray: Array.isArray(content),
        contentLength: typeof content === 'string' ? content.length : '非字符串'
      });
    } catch (parseError: any) {
      console.error('JSON 解析失败:', parseError.message, 'jsonData:', jsonData?.substring(0, 100));
      return NextResponse.json(
        {
          error: 'JSON 数据格式无效',
          message: parseError.message,
          sampleJson: {
            title: "文档标题",
            content: "文档内容...",
            // 或者使用blocks格式
            feishu_doc_title: "飞书文档标题",
            blocks: [
              { type: "paragraph", text: "段落文字" },
              { type: "bullet", text: "列表项" },
              { type: "quote", text: "引用文字" }
            ]
          }
        },
        { status: 400 }
      );
    }

    // 获取飞书访问令牌
    const accessToken = await getFeishuAccessToken(appId, appSecret);

    // 获取空间ID（使用默认值，前端不发送 Space ID）
    const spaceId = '7205903378588893188'; // 默认空间 ID
    console.log('使用空间ID:', spaceId);

    // 创建文档
    const result = await createFeishuDocument(accessToken, spaceId, title, content);

    return NextResponse.json({
      success: true,
      message: '文档创建成功',
      data: result
    });

  } catch (error: any) {
    console.error('飞书 API 处理错误:', error);

    return NextResponse.json(
      {
        error: '处理请求时发生错误',
        message: error.message || '未知错误'
      },
      { status: 500 }
    );
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