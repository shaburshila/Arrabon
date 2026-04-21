import { createHash, timingSafeEqual } from "node:crypto";

function sha256Utf8(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function timingSafeEqualSecret(expected: string, provided: string): boolean {
  return timingSafeEqual(sha256Utf8(expected), sha256Utf8(provided));
}
