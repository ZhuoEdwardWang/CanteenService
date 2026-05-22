const WECHAT_BASE = "https://api.weixin.qq.com/cgi-bin/";

async function wxRequest(path, params, body) {
  const url = new URL(path, WECHAT_BASE);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`WeChat API ${data.errcode}: ${data.errmsg}`);
  }
  return data;
}

export async function getAccessToken({ appId, appSecret }) {
  if (!appId || !appSecret) throw new Error("缺少 WECHAT_APP_ID 或 WECHAT_APP_SECRET");
  const data = await wxRequest("token", {
    grant_type: "client_credential",
    appid: appId,
    secret: appSecret
  });
  if (!data.access_token) throw new Error("微信没有返回 access_token");
  return data.access_token;
}

export async function sendPreviewText({ accessToken, openId, content }) {
  if (!openId) throw new Error("缺少 WECHAT_PREVIEW_OPENID");
  return wxRequest("message/mass/preview", { access_token: accessToken }, {
    touser: openId,
    msgtype: "text",
    text: { content }
  });
}

export async function sendMassText({ accessToken, content, mode = "all", tagId = "" }) {
  const filter = mode === "tag"
    ? { is_to_all: false, tag_id: Number(tagId) }
    : { is_to_all: true };

  return wxRequest("message/mass/sendall", { access_token: accessToken }, {
    filter,
    msgtype: "text",
    text: { content }
  });
}

export async function sendMessage(config, content) {
  const accessToken = await getAccessToken({
    appId: config.wechatAppId,
    appSecret: config.wechatAppSecret
  });

  if (config.wechatPreviewOpenId) {
    return sendPreviewText({
      accessToken,
      openId: config.wechatPreviewOpenId,
      content
    });
  }

  return sendMassText({
    accessToken,
    content,
    mode: config.wechatSendMode,
    tagId: config.wechatTagId
  });
}
