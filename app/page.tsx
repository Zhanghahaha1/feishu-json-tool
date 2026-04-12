"use client"

import { useState, useEffect } from "react"
import { Settings, X, FileJson, Send, Check } from "lucide-react"
import axios from 'axios'
import { toast } from "sonner"

export default function JsonToFeishuPage() {
  const [isConfigured, setIsConfigured] = useState(false)
  const [appId, setAppId] = useState("")
  const [appSecret, setAppSecret] = useState("")
  const [jsonContent, setJsonContent] = useState("")
  const [showSettings, setShowSettings] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successLink, setSuccessLink] = useState("")

  // 临时存储设置弹窗中的值
  const [tempAppId, setTempAppId] = useState("")
  const [tempAppSecret, setTempAppSecret] = useState("")
  // 验证状态
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState("")

  useEffect(() => {
    // 注释掉原有逻辑，强制显示配置页面
    // const savedAppId = localStorage.getItem("feishu_app_id")
    // const savedAppSecret = localStorage.getItem("feishu_app_secret")
    // if (savedAppId && savedAppSecret) {
    //   setAppId(savedAppId)
    //   setAppSecret(savedAppSecret)
    //   setIsConfigured(true)
    // }

    // 新增：清除所有凭证
    localStorage.clear()
    setIsConfigured(false)
  }, [])

  const handleInitialSubmit = () => {
    if (appId.trim() && appSecret.trim()) {
      localStorage.setItem("feishu_app_id", appId)
      localStorage.setItem("feishu_app_secret", appSecret)
      setIsConfigured(true)
    }
  }

  const handleSettingsReset = async () => {
    if (!tempAppId.trim() || !tempAppSecret.trim()) {
      return
    }

    // 重置验证错误
    setVerifyError("")
    setIsVerifying(true)

    try {
      console.log(">>> 开始验证飞书凭证...")

      // 调用验证接口
      const res = await axios.post('/api/verify', {
        appId: tempAppId,
        appSecret: tempAppSecret
      })

      if (res.data.success) {
        console.log(">>> 凭证验证成功，保存配置")
        // 验证成功，保存配置并关闭弹窗
        setAppId(tempAppId)
        setAppSecret(tempAppSecret)
        localStorage.setItem("feishu_app_id", tempAppId)
        localStorage.setItem("feishu_app_secret", tempAppSecret)
        localStorage.setItem('feishu_creds', JSON.stringify({ appId: tempAppId, appSecret: tempAppSecret }))
        setShowSettings(false)
        setTempAppId("")
        setTempAppSecret("")
        // 可以在这里添加成功Toast，但UI已存档，暂用alert
        toast.success("凭证验证成功，配置已保存")
      } else {
        throw new Error(res.data.error || "凭证验证失败")
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || "验证请求失败"
      console.error(">>> 凭证验证失败:", msg)
      // 显示错误Toast，暂用alert
      toast.error("凭证验证失败: " + msg)
      setVerifyError(msg)
      // 验证失败，保持弹窗打开
    } finally {
      setIsVerifying(false)
    }
  }

  const handleOpenSettings = () => {
    setTempAppId(appId)
    setTempAppSecret(appSecret)
    setShowSettings(true)
  }

  const handleJsonSubmit = async () => {
    // 1. 立即重置所有状态，防止 UI 卡死
    setIsSubmitting(true);
    setShowSuccess(false);
    setErrorMessage("");

    console.log(">>> 开始执行真实的 Axios 请求");
    localStorage.removeItem('feishu_creds');

    if (!jsonContent.trim()) {
      setIsSubmitting(false);
      return;
    }

    try {
      // 解析JSON内容
      let parsedData;
      try {
        parsedData = JSON.parse(jsonContent);
      } catch (parseError) {
        throw new Error("JSON格式无效");
      }

      // 提取必要字段
      const title = parsedData.title || "未命名文档";
      const folderToken = parsedData.folderToken || "";

      // 处理内容：优先使用blocks，其次使用content
      let blocks = parsedData.blocks;
      if (!blocks && parsedData.content) {
        // 将纯文本内容转换为简单的blocks格式
        blocks = [
          {
            type: "text",
            content: parsedData.content
          }
        ];
      }

      if (!blocks || !Array.isArray(blocks)) {
        throw new Error("JSON必须包含有效的blocks数组或content字段");
      }

      // 2. 从本地缓存获取最新的凭证（防止 State 没更新）
      const savedCreds = JSON.parse(localStorage.getItem('feishu_creds') || '{}');
      const finalAppId = appId || savedCreds.appId;
      const finalAppSecret = appSecret || savedCreds.appSecret;

      const res = await axios.post('/api/feishu', {
        appId: finalAppId,
        appSecret: finalAppSecret,
        folderToken,
        title,
        blocks
      });

      if (res.data.success) {
        setShowSuccess(true); // 只有后端返回成功，才准显示“转换成功”
        const documentUrl = res.data.data?.documentUrl || res.data.documentUrl;
        if (documentUrl) {
          setSuccessLink(documentUrl);
        }
      } else {
        throw new Error(res.data.error || "未知错误");
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "请求失败";
      console.error(">>> 物理报错:", msg);
      alert("转换失败: " + msg); // 失败必须弹窗告知
      setShowSuccess(false); // 失败必须切回原始按钮状态
    } finally {
      setIsSubmitting(false);
    }
  }

  // 初始配置页面
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo 和标题 */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-foreground mb-6">
              <FileJson className="w-8 h-8 text-background" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              JSON to Feishu
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              配置您的飞书应用凭证以开始使用
            </p>
          </div>

          {/* 输入表单 */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                App ID
              </label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="请输入 App ID"
                className="w-full h-12 px-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                App Secret
              </label>
              <input
                type="password"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder="请输入 App Secret"
                className="w-full h-12 px-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all"
              />
            </div>

            <button
              onClick={handleInitialSubmit}
              disabled={!appId.trim() || !appSecret.trim()}
              className="w-full h-12 mt-6 rounded-xl bg-gradient-to-r from-foreground via-foreground/90 to-foreground text-background font-medium text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              完成配置
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            您的凭证将安全存储在本地
          </p>
        </div>
      </div>
    )
  }

  // JSON 编辑器页面
  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-foreground flex items-center justify-center">
              <FileJson className="w-4 h-4 text-background" />
            </div>
            <span className="font-semibold text-foreground">JSON to Feishu</span>
          </div>

          <button
            onClick={handleOpenSettings}
            className="w-9 h-9 rounded-xl bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors group"
          >
            <Settings className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-6">
          {/* 标题区域 */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              输入 JSON 数据
            </h2>
            <p className="text-sm text-muted-foreground">
              粘贴您的 JSON 内容，点击转换按钮生成飞书文档
            </p>
          </div>

          {/* JSON 输入框 */}
          <div className="relative">
            <textarea
              value={jsonContent}
              onChange={(e) => setJsonContent(e.target.value)}
              placeholder={`{
  "title": "文档标题",
  "content": "文档内容..."
}`}
              className="w-full h-96 p-6 rounded-2xl bg-card border border-border text-foreground font-mono text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/20 transition-all resize-none"
              spellCheck={false}
            />
            
            {/* JSON 行数指示器 */}
            <div className="absolute top-4 right-4 px-3 py-1 rounded-lg bg-muted text-xs text-muted-foreground">
              {jsonContent.split("\n").length} 行
            </div>
          </div>

          {/* 提交按钮 */}
          <button
            onClick={handleJsonSubmit}
            disabled={!jsonContent.trim() || isSubmitting}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#1a1a1a] via-[#333333] to-[#1a1a1a] dark:from-white dark:via-gray-200 dark:to-white text-background dark:text-foreground font-medium transition-all hover:shadow-lg hover:shadow-foreground/5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-background/30 border-t-background dark:border-foreground/30 dark:border-t-foreground rounded-full animate-spin" />
            ) : showSuccess ? (
              <>
                <Check className="w-5 h-5" />
                <span>转换成功</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>转换为飞书文档</span>
              </>
            )}
          </button>

          {/* 错误信息 */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive-foreground">
                {errorMessage}
              </p>
            </div>
          )}

          {/* 成功链接 */}
          {successLink && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <p className="text-sm text-green-600 dark:text-green-400">
                文档创建成功！
                <a
                  href={successLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 underline hover:opacity-80"
                >
                  点击查看文档
                </a>
              </p>
            </div>
          )}

          {/* 底部提示 */}
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span>已连接：{appId.slice(0, 8)}...</span>
            </div>
          </div>
        </div>
      </main>

      {/* 设置弹窗 */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 背景遮罩 */}
          <div 
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          />
          
          {/* 弹窗内容 */}
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-6">
            {/* 关闭按钮 */}
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors group"
            >
              <X className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>

            {/* 标题 */}
            <div className="pr-8">
              <h3 className="text-lg font-semibold text-foreground">
                重置 App 凭证
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                更新您的飞书应用 ID 和密钥
              </p>
            </div>

            {/* 输入框 */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  App ID
                </label>
                <input
                  type="text"
                  value={tempAppId}
                  onChange={(e) => setTempAppId(e.target.value)}
                  placeholder="请输入新的 App ID"
                  className="w-full h-11 px-4 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  App Secret
                </label>
                <input
                  type="password"
                  value={tempAppSecret}
                  onChange={(e) => setTempAppSecret(e.target.value)}
                  placeholder="请输入新的 App Secret"
                  className="w-full h-11 px-4 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all"
                />
              </div>
            </div>

            {/* 验证错误提示 */}
            {verifyError && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive-foreground">
                  <span className="font-medium">凭证验证失败: </span>
                  {verifyError}
                </p>
              </div>
            )}

            {/* 按钮组 */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 h-11 rounded-xl bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSettingsReset}
                disabled={!tempAppId.trim() || !tempAppSecret.trim() || isVerifying}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-foreground to-foreground/90 text-background font-medium text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                    <span>验证中...</span>
                  </>
                ) : (
                  "保存更改"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
