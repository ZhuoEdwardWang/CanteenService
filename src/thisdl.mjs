import { getZonedParts, isDateInWeek } from "./date.mjs";

const API_BASE = "https://api-mo.thishd.cn/";

async function request(path, params = {}) {
  const url = new URL(path, API_BASE);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      "content-type": "application/json",
      "Client": "web_mini"
    }
  });

  if (!response.ok) throw new Error(`THISDL API HTTP ${response.status}: ${url}`);
  const body = await response.json();
  if (body.code !== 200) throw new Error(`THISDL API ${body.code}: ${body.message || "unknown error"}`);
  return body.data;
}

export async function fetchWeekList({ school, pageSize = 200 }) {
  return request("api/info/canteen_week_list", {
    page: 1,
    page_size: pageSize,
    school
  });
}

export async function findWeekForDate({ school, isoDate }) {
  const weeks = await fetchWeekList({ school });
  const week = weeks.find((item) => item.school === school && isDateInWeek(isoDate, item.day_start));
  if (!week) {
    throw new Error(`没有找到 ${school} 在 ${isoDate} 所在周的菜单周 ID`);
  }
  return week;
}

export async function fetchMenuForDate({ date = new Date(), school, remark, timezone }) {
  const parts = typeof date === "string"
    ? getZonedParts(new Date(`${date}T12:00:00+08:00`), timezone)
    : getZonedParts(date, timezone);
  const week = await findWeekForDate({ school, isoDate: parts.isoDate });

  const data = await request("api/info/canteen_item_list", {
    page: 1,
    page_size: 150,
    week_id: week.id,
    week: parts.weekday,
    remark
  });

  return {
    date: parts.isoDate,
    weekday: parts.weekday,
    week,
    data
  };
}

function firstRealDish(data) {
  for (const value of Object.values(data)) {
    const groups = Array.isArray(value) ? value : [];
    for (const group of groups) {
      const row = Array.isArray(group?.row) ? group.row : Array.isArray(group) ? group : [];
      const dish = row.find((item) => item?.id && item.name_sc && item.name_sc !== "空占位");
      if (dish) return dish;
    }
  }
  return null;
}

export async function fetchMenuByWeekId({ weekId, week, remark, date = new Date(), timezone }) {
  const parts = typeof date === "string"
    ? getZonedParts(new Date(`${date}T12:00:00+08:00`), timezone)
    : getZonedParts(date, timezone);
  const weekday = week || parts.weekday;

  const data = await request("api/info/canteen_item_list", {
    page: 1,
    page_size: 150,
    week_id: weekId,
    week: weekday,
    remark
  });
  const dish = firstRealDish(data);

  return {
    date: parts.isoDate,
    weekday,
    week: {
      id: Number(weekId),
      school: dish?.school || "",
      week_title: data.title_date || dish?.week_title || "",
      day_start: dish?.day || ""
    },
    data
  };
}
