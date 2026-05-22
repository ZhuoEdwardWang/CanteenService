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

## 本地预览

```bash
cp .env.example .env
npm run test
```

常用命令：

```bash
node src/cli.mjs --meal lunch --dry-run
node src/cli.mjs --meal supper --dry-run
node src/cli.mjs --date 2026-05-22 --school 未来城 --meal lunch --dry-run
node src/cli.mjs --week-id 90 --week 星期一 --meal lunch --dry-run
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
PUSH_CHANNEL=wework-bot
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
  schedule = "45 3 * * 1-5"

[functions."push-supper"]
  schedule = "15 9 * * 1-5"
```

对应北京时间：

- 工作日 11:45 推午餐
- 工作日 17:15 推晚餐

在 Netlify 控制台配置环境变量，Scope 需要包含 Functions：

```bash
THISDL_SCHOOL=稻香湖
THISDL_REMARK=中学
THISDL_TIMEZONE=Asia/Shanghai
PUSH_CHANNEL=wework-bot
WEWORK_BOT_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=你的key
```

注意：不要把 webhook 写进 `netlify.toml`，Netlify Functions 运行时读取不到 toml 里的普通环境变量，也不适合把密钥提交到 Git。

测试方式：

1. Push 到你的 Git repo，让 Netlify 完成一次 Production deploy。
2. 到 Netlify 控制台的 Functions 页面。
3. 找到 `push-lunch` 或 `push-supper`，点 `Run now`。
4. 看企业微信群是否收到消息，并查看 Function logs。

Netlify Scheduled Functions 只会在 published deploy 上按计划运行，Deploy Preview 不会按计划执行。

### Cron 服务器

服务器 cron 示例，北京时间每天 11:45 和 17:15 推送：

```cron
45 11 * * * cd /path/to/THISDLMenuPush && /usr/bin/node src/cli.mjs --meal lunch --channel wework-bot
15 17 * * * cd /path/to/THISDLMenuPush && /usr/bin/node src/cli.mjs --meal supper --channel wework-bot
```

微信公众号群发能力受账号类型和微信规则限制；如果群发接口没有权限，可以把 `sendMessage` 换成企业微信应用消息或模板/订阅消息通道。
