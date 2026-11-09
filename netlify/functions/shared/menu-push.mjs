import { getConfig } from "../../../src/env.mjs";
import { formatMenuMessage } from "../../../src/format.mjs";
import { fetchMenuByWeekId, fetchMenuForDate, MenuWeekNotFoundError } from "../../../src/thisdl.mjs";
import { sendMessage } from "../../../src/wechat.mjs";
import { sendWeworkBotMessage } from "../../../src/wework-bot.mjs";

async function buildMenuMessage(meal) {
  const config = getConfig();
  const menu = config.weekId
    ? await fetchMenuByWeekId({
      weekId: config.weekId,
      date: new Date(),
      remark: config.remark,
      timezone: config.timezone
    })
    : await fetchMenuForDate({
      date: new Date(),
      school: config.school,
      remark: config.remark,
      timezone: config.timezone
    });

  return {
    config,
    content: formatMenuMessage({
      menu,
      meal,
      school: menu.week.school || config.school,
      remark: config.remark
    })
  };
}

async function pushContent(config, content) {
  const channel = config.pushChannel || (config.weworkBotWebhook ? "wework-bot" : "wechat-official");
  if (channel === "wework-bot") {
    return sendWeworkBotMessage({
      webhook: config.weworkBotWebhook,
      content
    });
  }
  return sendMessage(config, content);
}

export async function runScheduledPush(meal) {
  try {
    const { config, content } = await buildMenuMessage(meal);
    const result = await pushContent(config, content);
    console.log(content);
    console.log(JSON.stringify(result));

    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (error) {
    if (error instanceof MenuWeekNotFoundError) {
      // 菜谱尚未发布属于上游数据状态，不应让定时任务以 500 失败。
      console.warn(error.message);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: error.message }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    console.error(error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}
