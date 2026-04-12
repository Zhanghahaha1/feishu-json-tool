import { NextRequest, NextResponse } from 'next/server';

// 飞书 API 基础 URL
const FEISHU_BASE_URL = 'https://open.feishu.cn/open-apis';

// 获取飞书访问令牌（验证凭证）
async function getFeishuAccessToken(appId: string, appSecret: string): Promise<string> {
  try {
    console.log('验证飞书凭证，App ID:', appId ? `${appId.substring(0, 8)}...` : 'empty');

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
      console.error('验证凭证失败 - 状态:', response.status, response.statusText, '响应:', errorText);

      let errorMessage = `验证凭证失败: ${response.status} ${response.statusText}`;
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
    console.error('验证飞书凭证错误:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json();
    const { appId, appSecret } = body;

    console.log('验证接口接收:', {
      appId: appId ? `${appId.substring(0, 8)}...` : 'empty',
      appSecret: appSecret ? '***' : 'empty',
    });

    // 验证必要参数
    if (!appId || !appSecret) {
      console.log('缺少参数:', { appId: !!appId, appSecret: !!appSecret });
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要参数',
          details: { appId: !!appId, appSecret: !!appSecret }
        },
        { status: 400 }
      );
    }

    // 尝试获取访问令牌（验证凭证）
    const accessToken = await getFeishuAccessToken(appId, appSecret);

    // 如果成功获取到token，说明凭证有效
    console.log('凭证验证成功，获取到访问令牌:', accessToken ? `${accessToken.substring(0, 10)}...` : 'empty');

    return NextResponse.json({
      success: true,
      message: '凭证验证成功',
      data: {
        isValid: true,
        tokenPreview: accessToken ? `${accessToken.substring(0, 10)}...` : ''
      }
    });

  } catch (error: any) {
    console.error('凭证验证失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: '凭证验证失败',
        message: error.message || '未知错误',
        details: {
          suggestion: '请检查 App ID 和 App Secret 是否正确，并确保应用已启用'
        }
      },
      { status: 401 }
    );
  }
}

// GET 请求处理：健康检查
export async function GET() {
  return NextResponse.json({
    service: 'Feishu Credentials Verification Service',
    status: 'active',
    endpoints: ['POST /api/verify'],
    description: '飞书凭证验证 API'
  });
}