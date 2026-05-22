export async function sendWeworkBotMessage({ webhook, content }) {
  if (!webhook) throw new Error("缺少 WEWORK_BOT_WEBHOOK");

  const response = await fetch(webhook, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      msgtype: "text",
      text: {
        content
      }
    })
  });

  if (!response.ok) throw new Error(`企业微信 Bot HTTP ${response.status}`);
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`企业微信 Bot ${data.errcode}: ${data.errmsg}`);
  }
  return data;
}
