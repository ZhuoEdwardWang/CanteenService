import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export function loadDotEnv(file = ".env") {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const raw = trimmed.slice(index + 1).trim();
    const value = raw.replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

export function getConfig(overrides = {}) {
  return {
    school: overrides.school || process.env.THISDL_SCHOOL || "未来城",
    remark: overrides.remark || process.env.THISDL_REMARK || "小学",
    weekId: overrides.weekId || process.env.THISDL_WEEK_ID || "",
    timezone: process.env.THISDL_TIMEZONE || "Asia/Shanghai",
    wechatAppId: process.env.WECHAT_APP_ID || "",
    wechatAppSecret: process.env.WECHAT_APP_SECRET || "",
    wechatSendMode: process.env.WECHAT_SEND_MODE || "all",
    wechatTagId: process.env.WECHAT_TAG_ID || "",
    wechatPreviewOpenId: process.env.WECHAT_PREVIEW_OPENID || "",
    weworkBotWebhook: process.env.WEWORK_BOT_WEBHOOK || "",
    pushChannel: process.env.PUSH_CHANNEL || ""
  };
}
