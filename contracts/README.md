# Arrabon smart contracts

`ConsultEscrow.sol` implements the onchain lifecycle for a single scheduled
consultation paid in USDC on Base.

## Responsibilities

- atomically creates and funds a deal;
- enforces one funded deal per consultation link;
- verifies short-lived EIP-712 funding authorizations;
- holds USDC until release or refund;
- records completion, dispute, release and refund transitions;
- supports seller-initiated auto-release after the fixed response window;
- applies compliance holds to payout paths;
- calculates and transfers the protocol fee.

The contract uses OpenZeppelin access control, signature and token-safety
primitives. Tests live in [`tests/contract`](../tests/contract).

## Mainnet deployment

- Network: Base Mainnet (`8453`)
- Contract:
  [`0x2EB0e35AbF9035f7A3B1807B857dc33518D1C5aD`](https://basescan.org/address/0x2EB0e35AbF9035f7A3B1807B857dc33518D1C5aD)
- Deployment records: [`docs/deployments.md`](../docs/deployments.md)
- Contract specification:
  [`CONSULT_ESCROW_SPEC.md`](CONSULT_ESCROW_SPEC.md)

The application and contract are no longer actively maintained. This directory
is retained as part of the Arrabon portfolio case.
