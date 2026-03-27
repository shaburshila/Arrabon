import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_BYTE_LENGTH = 12;
const KEY_HEX_PATTERN = /^[a-fA-F0-9]{64}$/;

function loadMeetingUrlEncryptionKey(): Buffer {
  const rawValue = process.env.MEETING_URL_ENCRYPTION_KEY?.trim();

  if (!rawValue) {
    throw new Error("Missing required environment variable: MEETING_URL_ENCRYPTION_KEY");
  }

  if (!KEY_HEX_PATTERN.test(rawValue)) {
    throw new Error(
      "Invalid MEETING_URL_ENCRYPTION_KEY format. Expected exactly 64 hex characters.",
    );
  }

  const key = Buffer.from(rawValue, "hex");

  if (key.length !== 32) {
    throw new Error("Invalid MEETING_URL_ENCRYPTION_KEY length. Expected 32 decoded bytes.");
  }

  return key;
}

const meetingUrlEncryptionKey = loadMeetingUrlEncryptionKey();

export function encryptMeetingUrl(meetingUrl: string): string {
  const iv = randomBytes(IV_BYTE_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, meetingUrlEncryptionKey, iv);
  const encryptedBuffer = Buffer.concat([
    cipher.update(meetingUrl, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encryptedBuffer.toString("hex"),
  ].join(":");
}

export function decryptMeetingUrl(payload: string): string {
  const parts = payload.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted meeting URL payload format.");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encryptedBuffer = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, meetingUrlEncryptionKey, iv);

  decipher.setAuthTag(authTag);

  const decryptedBuffer = Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final(),
  ]);

  return decryptedBuffer.toString("utf8");
}
