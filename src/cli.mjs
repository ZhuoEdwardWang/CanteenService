#!/usr/bin/env node
import { loadDotEnv, getConfig } from "./env.mjs";
import { fetchMenuByWeekId, fetchMenuForDate } from "./thisdl.mjs";
import { formatMenuMessage } from "./format.mjs";
import { sendMessage } from "./wechat.mjs";
import { sendWeworkBotMessage } from "./wework-bot.mjs";

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    args[key] = argv[index + 1];
    index += 1;
  }
  return args;
}

async function main() {
  loadDotEnv();
  const args = parseArgs(process.argv);
  const meal = args.meal || "lunch";
  if (!["lunch", "supper"].includes(meal)) {
    throw new Error("--meal 只能是 lunch 或 supper");
  }

  const config = getConfig({
    school: args.school,
    remark: args.remark
  });

  const weekId = args.weekId || config.weekId;
  const menu = weekId
    ? await fetchMenuByWeekId({
      weekId,
      week: args.week,
      date: args.date || new Date(),
      remark: config.remark,
      timezone: config.timezone
    })
    : await fetchMenuForDate({
      date: args.date || new Date(),
      school: config.school,
      remark: config.remark,
      timezone: config.timezone
    });

  const content = formatMenuMessage({
    menu,
    meal,
    school: menu.week.school || config.school,
    remark: config.remark
  });

  if (args.dryRun) {
    console.log(content);
    return;
  }

  const channel = args.channel || config.pushChannel || (config.weworkBotWebhook ? "wework-bot" : "wechat-official");
  const result = channel === "wework-bot"
    ? await sendWeworkBotMessage({
      webhook: config.weworkBotWebhook,
      content
    })
    : await sendMessage(config, content);

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
