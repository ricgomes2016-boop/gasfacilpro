const RAW_BUILD_ID = typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "dev";

function parseBuildDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatBuildLabel(value = RAW_BUILD_ID) {
  const parsed = parseBuildDate(value);
  if (!parsed) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(parsed)
    .replace(",", "");
}

export const APP_BUILD_ID = RAW_BUILD_ID;
export const APP_BUILD_LABEL = formatBuildLabel();