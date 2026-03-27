import { randomBytes } from "crypto";
import { baseRuntimeConfig } from "@/lib/base/config";
import { getAddress, isAddress, isHex, verifyMessage, type Address, type Hex } from "viem";

export const AUTH_NONCE_TTL_MS = 10 * 60 * 1000;

const SIWE_HEADER_SUFFIX = " wants you to sign in with your Ethereum account:";

export interface ParsedSiweMessage {
  address: Address;
  chainId: number;
  domain: string;
  expirationTime: string | null;
  issuedAt: string;
  message: string;
  nonce: string;
  requestId: string | null;
  resources: string[];
  signature: Hex;
  statement: string | null;
  uri: string;
  version: string;
}

function parseRequiredDate(value: string, field: string): string {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`Invalid SIWE ${field}.`);
  }

  return value;
}

function parseOptionalDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  if (Number.isNaN(Date.parse(value))) {
    throw new Error("Invalid SIWE expiration time.");
  }

  return value;
}

function parseFieldMap(lines: string[]) {
  const fields = new Map<string, string>();
  const resources: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line) {
      continue;
    }

    if (line === "Resources:") {
      index += 1;

      while (index < lines.length) {
        const resourceLine = lines[index];

        if (!resourceLine.startsWith("- ")) {
          index -= 1;
          break;
        }

        resources.push(resourceLine.slice(2));
        index += 1;
      }

      continue;
    }

    const separatorIndex = line.indexOf(": ");

    if (separatorIndex <= 0) {
      throw new Error("Malformed SIWE field line.");
    }

    const key = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 2).trim();
    fields.set(key, value);
  }

  return { fields, resources };
}

export function normalizeWalletAddress(wallet: string): Address {
  if (!isAddress(wallet)) {
    throw new Error("Invalid wallet address.");
  }

  return getAddress(wallet);
}

export function generateAuthNonce(): string {
  return randomBytes(16).toString("hex");
}

export function parseSiweMessage(message: string): Omit<ParsedSiweMessage, "message" | "signature"> {
  const normalizedMessage = message.replace(/\r\n/g, "\n");
  const lines = normalizedMessage.split("\n");
  const header = lines[0]?.trim();

  if (!header?.endsWith(SIWE_HEADER_SUFFIX)) {
    throw new Error("Invalid SIWE header.");
  }

  if (lines[2] !== "") {
    throw new Error("Malformed SIWE message body.");
  }

  const address = normalizeWalletAddress(lines[1]?.trim() ?? "");
  const domain = header.slice(0, -SIWE_HEADER_SUFFIX.length).trim().toLowerCase();
  const firstFieldIndex = lines.findIndex((line, index) => index >= 3 && line.startsWith("URI: "));

  if (firstFieldIndex === -1) {
    throw new Error("Missing SIWE fields.");
  }

  const statementLines = lines.slice(3, firstFieldIndex);
  const statement = statementLines.length === 0 ? null : statementLines.join("\n").trim() || null;
  const { fields, resources } = parseFieldMap(lines.slice(firstFieldIndex));
  const version = fields.get("Version");
  const chainIdRaw = fields.get("Chain ID");
  const nonce = fields.get("Nonce");
  const issuedAt = fields.get("Issued At");
  const uri = fields.get("URI");

  if (!version || !chainIdRaw || !nonce || !issuedAt || !uri) {
    throw new Error("Missing required SIWE fields.");
  }

  if (version !== "1") {
    throw new Error("Unsupported SIWE version.");
  }

  const chainId = Number(chainIdRaw);

  if (!Number.isInteger(chainId)) {
    throw new Error("Invalid SIWE chain ID.");
  }

  return {
    address,
    chainId,
    domain,
    expirationTime: parseOptionalDate(fields.get("Expiration Time")),
    issuedAt: parseRequiredDate(issuedAt, "issued_at"),
    nonce,
    requestId: fields.get("Request ID") ?? null,
    resources,
    statement,
    uri,
    version,
  };
}

export async function verifySiweMessage(input: {
  expectedDomain: string;
  message: string;
  signature: string;
}) {
  const { expectedDomain, message, signature } = input;

  if (!isHex(signature)) {
    throw new Error("Invalid SIWE signature.");
  }

  const normalizedSignature = signature as Hex;

  const parsedMessage = parseSiweMessage(message);
  const normalizedExpectedDomain = expectedDomain.trim().toLowerCase();

  if (parsedMessage.domain !== normalizedExpectedDomain) {
    throw new Error("SIWE domain mismatch.");
  }

  if (parsedMessage.chainId !== baseRuntimeConfig.chainId) {
    throw new Error("SIWE chain mismatch.");
  }

  if (parsedMessage.expirationTime && Date.parse(parsedMessage.expirationTime) <= Date.now()) {
    throw new Error("SIWE message expired.");
  }

  const isValidSignature = await verifyMessage({
    address: parsedMessage.address,
    message,
    signature: normalizedSignature,
  });

  if (!isValidSignature) {
    throw new Error("Invalid SIWE signature.");
  }

  return {
    ...parsedMessage,
    message,
    signature: normalizedSignature,
  } satisfies ParsedSiweMessage;
}
