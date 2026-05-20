export function canSubmitDenylistRemoval(comment: string): boolean {
  return comment.trim().length > 0;
}
