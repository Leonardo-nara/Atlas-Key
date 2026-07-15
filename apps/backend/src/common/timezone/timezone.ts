import { BadRequestException } from "@nestjs/common";

export const DEFAULT_STORE_TIMEZONE = "America/Sao_Paulo";

export type PlainDateParts = {
  year: number;
  month: number;
  day: number;
};

export function normalizeTimeZone(value: string | null | undefined) {
  const timezone = value?.trim() || DEFAULT_STORE_TIMEZONE;

  if (!isValidTimeZone(timezone)) {
    throw new BadRequestException("Timezone invalido. Use um identificador IANA valido.");
  }

  return timezone;
}

export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function getZonedDateParts(date: Date, timeZone: string): PlainDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value)
  };
}

export function addDays(parts: PlainDateParts, days: number): PlainDateParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

export function zonedStartOfDayToUtc(parts: PlainDateParts, timeZone: string) {
  return zonedDateTimeToUtc({ ...parts, hour: 0, minute: 0, second: 0, millisecond: 0 }, timeZone);
}

export function getTodayRangeForTimeZone(timeZoneInput: string | null | undefined, reference = new Date()) {
  const timeZone = normalizeTimeZone(timeZoneInput);
  const startOfTodayParts = getZonedDateParts(reference, timeZone);
  const startOfTomorrowParts = addDays(startOfTodayParts, 1);

  return {
    startOfToday: zonedStartOfDayToUtc(startOfTodayParts, timeZone),
    startOfTomorrow: zonedStartOfDayToUtc(startOfTomorrowParts, timeZone),
    timeZone
  };
}

function zonedDateTimeToUtc(
  parts: PlainDateParts & { hour: number; minute: number; second: number; millisecond: number },
  timeZone: string
) {
  let utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = getTimeZoneOffsetMs(utc, timeZone);
    const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond) - offset);

    if (next.getTime() === utc.getTime()) {
      return next;
    }

    utc = next;
  }

  return utc;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const localAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return localAsUtc - date.getTime();
}
