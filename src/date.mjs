const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

export function getZonedParts(date = new Date(), timezone = "Asia/Shanghai") {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });

  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const isoDate = `${parts.year}-${parts.month}-${parts.day}`;
  const weekdayIndex = new Date(`${isoDate}T00:00:00Z`).getUTCDay();

  return {
    isoDate,
    weekday: WEEKDAYS[weekdayIndex]
  };
}

export function parseDayStart(dayStart) {
  if (!/^\d{6}$/.test(dayStart)) return null;
  const year = Number(`20${dayStart.slice(0, 2)}`);
  const month = Number(dayStart.slice(2, 4));
  const day = Number(dayStart.slice(4, 6));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isDateInWeek(isoDate, dayStart) {
  const start = parseDayStart(dayStart);
  if (!start) return false;
  const end = addDays(start, 6);
  return isoDate >= start && isoDate <= end;
}

export function toDayStart(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ""));
  if (!match) return "";
  return `${match[1].slice(2)}${match[2]}${match[3]}`;
}

export function weekdayForDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return WEEKDAYS[date.getUTCDay()];
}

// 菜单接口返回的周标题形如 "2026.11.09-2026.11.15"。
export function parseWeekTitle(title) {
  const match = /^(\d{4})\.(\d{2})\.(\d{2})\s*-\s*(\d{4})\.(\d{2})\.(\d{2})$/
    .exec(String(title || "").trim());
  if (!match) return null;

  return {
    start: `${match[1]}-${match[2]}-${match[3]}`,
    end: `${match[4]}-${match[5]}-${match[6]}`
  };
}

// 返回 isoDate 所在周的周一（菜单周以周一为起点）。
export function startOfWeek(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const offset = (date.getUTCDay() + 6) % 7;
  return addDays(isoDate, -offset);
}
