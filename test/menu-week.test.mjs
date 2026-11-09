import test from "node:test";
import assert from "node:assert/strict";
import { fetchMenuForDate, findWeekForDate, MenuWeekNotFoundError } from "../src/thisdl.mjs";

const realFetch = globalThis.fetch;

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function weekListResponse(weeks) {
  return jsonResponse({ code: 200, message: "Succeeded", data: weeks });
}

function menuResponse(weekId, weekTitle, day) {
  return jsonResponse({
    code: 200,
    message: "Succeeded",
    data: {
      title_date: weekTitle,
      today_date: "11.09",
      lunch_meat_or_fish_dish: [{
        row: [{
          id: 1,
          school: "稻香湖",
          week_id: weekId,
          week_title: weekTitle,
          day,
          week: "星期一",
          name_sc: "测试菜",
          calorie: "100Kcal"
        }]
      }]
    }
  });
}

test("周列表缺少当前周时，按相邻 week_id 兜底", async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  const itemCalls = [];

  globalThis.fetch = async (url) => {
    const requestUrl = new URL(url);
    if (requestUrl.pathname.endsWith("canteen_week_list")) {
      return weekListResponse([{
        id: 148,
        school: "稻香湖",
        week_title: "2026.11.02-2026.11.08",
        day_start: "261102"
      }]);
    }
    if (requestUrl.pathname.endsWith("canteen_item_list")) {
      const weekId = Number(requestUrl.searchParams.get("week_id"));
      itemCalls.push(weekId);
      if (weekId === 149) return menuResponse(149, "2026.11.09-2026.11.15", "261109");
      return jsonResponse({ code: 11911, message: "week not found" });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  const menu = await fetchMenuForDate({
    date: "2026-11-09",
    school: "稻香湖",
    remark: "中学",
    timezone: "Asia/Shanghai"
  });

  assert.equal(menu.week.id, 149);
  assert.equal(menu.week.week_title, "2026.11.09-2026.11.15");
  assert.equal(menu.week.day_start, "261109");
  assert.deepEqual(itemCalls, [149]);
});

test("周列表命中时不再探测 week_id", async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  let itemListCalls = 0;

  globalThis.fetch = async (url) => {
    const requestUrl = new URL(url);
    if (requestUrl.pathname.endsWith("canteen_week_list")) {
      return weekListResponse([{
        id: 148,
        school: "稻香湖",
        week_title: "2026.11.02-2026.11.08",
        day_start: "261102"
      }]);
    }
    itemListCalls += 1;
    return menuResponse(148, "2026.11.02-2026.11.08", "261102");
  };

  const week = await findWeekForDate({
    school: "稻香湖",
    isoDate: "2026-11-02",
    remark: "中学"
  });

  assert.equal(week.id, 148);
  assert.equal(itemListCalls, 0);
});

test("菜单确实未发布时抛出可跳过的 MenuWeekNotFoundError", async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });

  globalThis.fetch = async (url) => {
    const requestUrl = new URL(url);
    if (requestUrl.pathname.endsWith("canteen_week_list")) {
      return weekListResponse([{
        id: 148,
        school: "稻香湖",
        week_title: "2026.11.02-2026.11.08",
        day_start: "261102"
      }]);
    }
    return jsonResponse({ code: 11911, message: "week not found" });
  };

  await assert.rejects(
    () => findWeekForDate({ school: "稻香湖", isoDate: "2026-11-16", remark: "中学" }),
    (error) => {
      assert.ok(error instanceof MenuWeekNotFoundError);
      assert.match(error.message, /2026-11-16/);
      assert.match(error.message, /尚未发布/);
      return true;
    }
  );
});
