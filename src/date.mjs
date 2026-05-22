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
