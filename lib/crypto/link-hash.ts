import "server-only";

import { randomBytes } from "crypto";

const LINK_HASH_HEX_LENGTH = 64;
const LINK_HASH_PATTERN = /^0x[a-f0-9]{64}$/;

export function generateLinkHash(): string {
  return `0x${randomBytes(32).toString("hex")}`;
}

export function isLinkHash(value: string): boolean {
  return LINK_HASH_PATTERN.test(value);
}

export function assertLinkHash(value: string): string {
  if (!LINK_HASH_PATTERN.test(value)) {
    throw new Error(
      `Invalid link hash format. Expected 0x + ${LINK_HASH_HEX_LENGTH} lowercase hex characters.`,
    );
  }

  return value;
}
