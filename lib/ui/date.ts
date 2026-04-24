export interface FormatDateOptions {
  fallback?: string;
  showTimeZoneName?: boolean;
  timeZone?: string;
}

export function formatDate(
  value: string | null,
  options: FormatDateOptions = {},
): string {
  const {
    fallback = "—",
    showTimeZoneName = false,
    timeZone = "UTC",
  } = options;

  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const formatOptions: Intl.DateTimeFormatOptions = {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
    ...(showTimeZoneName ? { timeZoneName: "short" } : {}),
  };

  try {
    return date.toLocaleString("en-US", formatOptions);
  } catch {
    return date.toLocaleString("en-US", {
      ...formatOptions,
      timeZone: "UTC",
    });
  }
}
