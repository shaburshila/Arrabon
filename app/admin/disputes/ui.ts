export function shouldShowFlaggedDeal(
  riskStatus: "Blocked" | "Clear" | "Review",
  showOnlyFlagged: boolean,
): boolean {
  return !showOnlyFlagged || riskStatus !== "Clear";
}
