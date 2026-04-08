// SIWE message builder for the frontend.
// Format must match what the backend parseSiweMessage() in lib/auth/siwe.ts expects.

export interface SiweMessageParams {
  address: string;
  chainId: number;
  domain: string;
  issuedAt: string;
  nonce: string;
  uri: string;
}

// Builds an EIP-4361 SIWE message string without a statement.
// Format matches the backend parser: line 0 = domain header, line 1 = address,
// line 2 = empty, line 3+ = fields starting with "URI: ".
export function buildSiweMessage(params: SiweMessageParams): string {
  const { address, chainId, domain, issuedAt, nonce, uri } = params;

  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    `URI: ${uri}`,
    "Version: 1",
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}
