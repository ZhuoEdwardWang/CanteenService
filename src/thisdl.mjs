import {
  getZonedParts,
  isDateInWeek,
  parseDayStart,
  parseWeekTitle,
  startOfWeek,
  toDayStart,
  weekdayForDate
} from "./date.mjs";

const API_BASE = "https://api-mo.thishd.cn/";

// 周列表接口偶尔会漏掉最新一周（例如 2026.11.09 这一周的 week_id=149），
// 但菜单明细接口仍然可以按 week_id 取到数据。这里最多探测 8 个相邻 ID。
const WEEK_PROBE_LIMIT = 8;

export class ThisdlApiError extends Error {
  constructor(code, message, url) {
    super(message);
    this.name = "ThisdlApiError";
    this.code = code;
    this.url = url;
  }
}

export class MenuWeekNotFoundError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "MenuWeekNotFoundError";
    Object.assign(this, details);
  }
}

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

  if (!response.ok) {
    throw new ThisdlApiError(response.status, `THISDL API HTTP ${response.status}: ${url}`, url);
  }
  const body = await response.json();
  if (body.code !== 200) {
    throw new ThisdlApiError(body.code, `THISDL API ${body.code}: ${body.message || "unknown error"}`, url);
  }
  return body.data;
}

export async function fetchWeekList({ school, pageSize = 200 }) {
  const data = await request("api/info/canteen_week_list", {
    page: 1,
    page_size: pageSize,
    school
  });
  return Array.isArray(data) ? data : [];
}

function firstItem(data) {
  for (const value of Object.values(data || {})) {
    const groups = Array.isArray(value) ? value : [];
    for (const group of groups) {
      const row = Array.isArray(group?.row) ? group.row : Array.isArray(group) ? group : [];
      const item = row.find((entry) => entry && entry.week_id);
      if (item) return item;
    }
  }
  return null;
}

function firstRealDish(data) {
  for (const value of Object.values(data || {})) {
    const groups = Array.isArray(value) ? value : [];
    for (const group of groups) {
      const row = Array.isArray(group?.row) ? group.row : Array.isArray(group) ? group : [];
      const dish = row.find((item) => item?.id && item.name_sc && item.name_sc !== "空占位");
      if (dish) return dish;
    }
  }
  return null;
}

function weekFromMenuData(id, data, school, isoDate) {
  const range = parseWeekTitle(data?.title_date);
  if (!range) return null;

  const item = firstItem(data);
  // 防止接口在 week_id 无效时回退到别的周（会返回不匹配的 week_id）。
  if (item && Number(item.week_id) !== Number(id)) return null;
  if (school && item?.school && item.school !== school) return null;
  // title_date 和实际菜品日期需要同时覆盖目标日期。
  if (item?.day && !isDateInWeek(isoDate, item.day)) return null;

  return {
    range,
    week: {
      id: Number(id),
      school: item?.school || school,
      week_title: data.title_date,
      day_start: toDayStart(range.start)
    }
  };
}

function knownWeeks(weeks, school) {
  return weeks
    .filter((item) => item && item.id !== undefined && parseDayStart(item.day_start))
    .filter((item) => !school || !item.school || item.school === school)
    .map((item) => ({ ...item, start: parseDayStart(item.day_start) }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

function pickAnchor(known, targetStart) {
  const latest = known[known.length - 1];
  const earliest = known[0];
  if (targetStart >= latest.start) return latest;
  if (targetStart <= earliest.start) return earliest;

  let anchor = earliest;
  for (const week of known) {
    if (week.start > targetStart) break;
    anchor = week;
  }
  return anchor;
}

function candidateWeekIds(anchor, targetStart) {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const diffWeeks = Math.round(
    (new Date(`${targetStart}T00:00:00Z`) - new Date(`${anchor.start}T00:00:00Z`)) / weekMs
  );
  const base = Number(anchor.id) + diffWeeks;

  const ids = [base];
  for (let offset = 1; offset <= WEEK_PROBE_LIMIT; offset += 1) {
    ids.push(base + offset, base - offset);
  }

  return [...new Set(ids)]
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, WEEK_PROBE_LIMIT);
}

async function findWeekByProbing({ school, isoDate, weekday, remark, weeks }) {
  const known = knownWeeks(weeks, school);
  if (known.length === 0) {
    throw new MenuWeekNotFoundError(
      `没有找到 ${school || ""} 在 ${isoDate} 所在周的菜单周 ID：周列表为空。`,
      { school, isoDate, probedWeekIds: [] }
    );
  }

  const targetStart = startOfWeek(isoDate);
  const anchor = pickAnchor(known, targetStart);
  const ids = candidateWeekIds(anchor, targetStart);

  let lastError = null;
  let responses = 0;

  for (const id of ids) {
    let data;
    try {
      data = await request("api/info/canteen_item_list", {
        page: 1,
        page_size: 150,
        week_id: id,
        week: weekday,
        remark
      });
    } catch (error) {
      // 11911 = 该 week_id 不存在，继续尝试相邻 ID。
      if (error instanceof ThisdlApiError && error.code === 11911) continue;
      lastError = error;
      continue;
    }

    responses += 1;
    const candidate = weekFromMenuData(id, data, school, isoDate);
    if (!candidate) continue;
    if (isoDate < candidate.range.start || isoDate > candidate.range.end) continue;

    console.warn(
      `[thisdl] 周列表缺少 ${isoDate} 所在周，已通过 week_id=${id} 找到 ${candidate.week.week_title}`
    );
    return { week: candidate.week, data };
  }

  if (responses === 0 && lastError) throw lastError;

  const latest = known[known.length - 1];
  const probed = ids.length > 0 ? `已尝试探测 week_id：${ids.join("、")}。` : "";
  throw new MenuWeekNotFoundError(
    `没有找到 ${school || ""} 在 ${isoDate} 所在周的菜单周 ID。` +
      `周列表最新一周为 ${latest.week_title || latest.start}（week_id=${latest.id}），${probed}` +
      "可能该周菜单尚未发布，或菜单周列表数据不完整。",
    { school, isoDate, weekListLatest: latest, probedWeekIds: ids }
  );
}

async function resolveWeekForDate({ school, isoDate, weekday, remark }) {
  const weeks = await fetchWeekList({ school });
  const week = weeks.find((item) => item.school === school && isDateInWeek(isoDate, item.day_start));
  if (week) return { week, data: null };

  return findWeekByProbing({ school, isoDate, weekday, remark, weeks });
}

export async function findWeekForDate({ school, isoDate, weekday, remark }) {
  const { week } = await resolveWeekForDate({
    school,
    isoDate,
    weekday: weekday || weekdayForDate(isoDate),
    remark
  });
  return week;
}

export async function fetchMenuForDate({ date = new Date(), school, remark, timezone }) {
  const parts = typeof date === "string"
    ? getZonedParts(new Date(`${date}T12:00:00+08:00`), timezone)
    : getZonedParts(date, timezone);

  const { week, data: probedData } = await resolveWeekForDate({
    school,
    isoDate: parts.isoDate,
    weekday: parts.weekday,
    remark
  });

  const data = probedData || await request("api/info/canteen_item_list", {
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
