# THISDL Menu Push

这个小工具会从 THISDL 菜谱接口读取当天菜单，并把午餐或晚餐格式化后推送到企业微信群机器人或微信公众号。

## 已确认的数据接口

菜单页面最终请求的是：

`https://api-mo.thishd.cn/api/info/canteen_item_list`

周列表接口是：

`https://api-mo.thishd.cn/api/info/canteen_week_list`

注意：`week_id` 并不是简单全局递增。不同校区会有不同 ID，并且会跳号。程序默认会先按 `school` 找到目标日期所在周，再请求当天菜单。

如果你已经有菜单链接里的 `id`，也可以直接指定：

```bash
node src/cli.mjs --week-id 90 --week 星期一 --meal lunch --dry-run
```

前端页面请求当天菜单时没有额外传 `school`，`week_id` 本身就能定位到某个校区的某一周；`school` 只用于程序自动查找“今天该用哪个 week_id”。

### 周列表可能漏掉当前周

上游 `canteen_week_list` 有时会晚于菜单明细更新。例如 2026-11-09 这一周：

- `canteen_week_list` 最新只到 `week_id=148`（2026.11.02-2026.11.08）
- 但 `canteen_item_list?week_id=149` 已经有 2026.11.09-2026.11.15 的完整菜单

程序会先按周列表查找；找不到时，以最近一周为锚点估算并探测相邻 `week_id`，再用菜单返回的 `title_date` 和 `school` 校验，避免因上游漏周而推送失败。日志里会出现：

```text
[thisdl] 周列表缺少 2026-11-09 所在周，已通过 week_id=149 找到 2026.11.09-2026.11.15
```

如果确认菜单已经发布，也可以直接指定：

```bash
node src/cli.mjs --week-id 149 --week 星期一 --meal lunch --dry-run
```

## 本地预览

```bash
cp .env.example .env
npm run preview:lunch
```

常用命令：

```bash
npm test                 # 离线回归测试，不访问真实接口
npm run preview:lunch    # 预览今天的午餐
npm run preview:supper   # 预览今天的晚餐
node src/cli.mjs --meal lunch --dry-run
node src/cli.mjs --meal supper --dry-run
node src/cli.mjs --date 2026-11-09 --school 稻香湖 --remark 中学 --meal lunch --dry-run
node src/cli.mjs --week-id 149 --week 星期一 --meal lunch --dry-run
```

## 企业微信 Bot 推送

推荐先用这个方式部署：简单、稳定，不需要公众号群发权限。

1. 在企业微信群里添加「群机器人」。
2. 复制机器人 webhook，写入 `.env`。
3. 运行午餐或晚餐推送命令。

`.env` 示例：

```bash
THISDL_SCHOOL=稻香湖
THISDL_REMARK=中学
PUSH_CHANNEL=
WEWORK_BOT_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=你的key
```

运行：

```bash
npm run bot:lunch
npm run bot:supper
```

也可以继续 dry-run 预览：

```bash
node src/cli.mjs --school 稻香湖 --remark 中学 --meal lunch --dry-run
```

## 微信公众号推送

填入 `.env`：

```bash
WECHAT_APP_ID=你的公众号AppID
WECHAT_APP_SECRET=你的公众号AppSecret
```

然后运行：

```bash
npm run push:lunch
npm run push:supper
```

默认使用微信公众号「群发文本」接口。若只想给一个测试用户预览，配置：

```bash
WECHAT_PREVIEW_OPENID=用户openid
```

## 定时任务

### Netlify Scheduled Functions

如果项目已经连接了 Netlify，可以直接用 Netlify 部署，不需要自己维护服务器。

本项目已经包含：

```text
netlify.toml
netlify/functions/push-lunch.mjs
netlify/functions/push-supper.mjs
```

`netlify.toml` 里的 cron 使用 UTC 时间：

```toml
[functions."push-lunch"]
  schedule = "45 2 * * 1-5"

[functions."push-supper"]
  schedule = "00 8 * * 1-5"
```

对应北京时间：

- 工作日 10:45 推午餐
- 工作日 16:00 推晚餐

在 Netlify 控制台配置环境变量，Scope 需要包含 Functions：

```bash
THISDL_SCHOOL=稻香湖
THISDL_REMARK=中学
THISDL_TIMEZONE=Asia/Shanghai
PUSH_CHANNEL=
WEWORK_BOT_WEBHOOK=******
```

注意：不要把 webhook 写进 `netlify.toml`，Netlify Functions 运行时读取不到 toml 里的普通环境变量，也不适合把密钥提交到 Git。

测试方式：

1. Push 到你的 Git repo，让 Netlify 完成一次 Production deploy。
2. 到 Netlify 控制台的 Functions 页面。
3. 找到 `push-lunch` 或 `push-supper`，点 `Run now`。
4. 看企业微信群是否收到消息，并查看 Function logs。

Netlify Scheduled Functions 只会在 published deploy 上按计划运行，Deploy Preview 不会按计划执行。

### 常见问题：没有找到 … 所在周的菜单周 ID

例如日志中出现：

```text
Error: 没有找到 稻香湖 在 2026-11-09 所在周的菜单周 ID
```

这是上游周列表漏周导致的。2026-11-09 当天实测 `canteen_week_list` 没有 `week_id=149`，但 `canteen_item_list?week_id=149` 返回了完整菜单。当前版本会自动探测相邻 `week_id`，正常情况下不会再报错。

如果探测后仍找不到，说明该周菜单确实还没发布，或 `THISDL_SCHOOL` 写错了。定时函数会记录警告并返回：

```json
{ "ok": true, "skipped": true, "reason": "..." }
```

而不是以 500 失败；等菜单发布后下一次定时任务会自动恢复。需要手动预览时可以直接指定已知的 `week_id`：

```bash
node src/cli.mjs --week-id 149 --week 星期一 --meal lunch --dry-run
```

### Cron 服务器

服务器 cron 示例，北京时间每天 11:45 和 17:15 推送：

```cron
45 11 * * * cd /path/to/THISDLMenuPush && /usr/bin/node src/cli.mjs --meal lunch --channel wework-bot
15 17 * * * cd /path/to/THISDLMenuPush && /usr/bin/node src/cli.mjs --meal supper --channel wework-bot
```

微信公众号群发能力受账号类型和微信规则限制；如果群发接口没有权限，可以把 `sendMessage` 换成企业微信应用消息或模板/订阅消息通道。
