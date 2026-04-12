## 核心任务：彻底修复 Axios 逻辑闭环与 UI 状态同步

### 1. 物理重写 handleJsonSubmit 函数
- **必须执行**：在 `app/page.tsx` 中找到 `handleJsonSubmit` 函数，用以下逻辑彻底覆盖：
```typescript
const handleJsonSubmit = async () => {
  // 1. 立即重置所有状态，防止 UI 卡死
  setIsSubmitting(true);
  setShowSuccess(false); 
  setErrorMessage("");

  console.log(">>> 开始执行真实的 Axios 请求");

  try {
    // 2. 从本地缓存获取最新的凭证（防止 State 没更新）
    const savedCreds = JSON.parse(localStorage.getItem('feishu_creds') || '{}');
    const finalAppId = appId || savedCreds.appId;
    const finalAppSecret = appSecret || savedCreds.appSecret;

    const res = await axios.post('/api/feishu', {
      appId: finalAppId,
      appSecret: finalAppSecret,
      folderToken,
      title,
      blocks: jsonOutput
    });

    if (res.data.success) {
      setShowSuccess(true); // 只有后端返回成功，才准显示“转换成功”
      setSuccessLink(res.data.url);
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
};

禁止事项：
严禁修改 CSS：保留现在的样式。

严禁模拟跳转：必须严格判断 res.data.success