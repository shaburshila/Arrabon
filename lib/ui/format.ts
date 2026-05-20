export function formatUsdcPrice(raw: string | number): string {
  const num = typeof raw === "string" ? parseFloat(raw) : raw;
  if (Number.isNaN(num)) return String(raw);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
