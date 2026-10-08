# Arrabon smart contract

`ConsultEscrow.sol` implements the USDC escrow lifecycle for one scheduled
consultation on Base.

It:

- creates and funds a deal in one transaction;
- enforces one deal per link hash;
- verifies short-lived EIP-712 funding authorizations;
- holds consultation price and fee in USDC;
- records completion, dispute, release, and refund;
- supports seller auto-release after the fixed response window;
- lets admins apply participant payout holds and resolve disputes;
- prevents rescue of the configured escrow USDC.

The contract uses OpenZeppelin `SafeERC20` and `ReentrancyGuard`. Owner and
admin roles, EIP-712 recovery, and replay protection are implemented in the
contract itself.

Tests live in [`tests/contract`](../tests/contract). The contract did not
receive an external audit.

## Mainnet deployment

- Network: Base Mainnet, chain ID `8453`
- Contract:
  [`0x2EB0e35AbF9035f7A3B1807B857dc33518D1C5aD`](https://basescan.org/address/0x2EB0e35AbF9035f7A3B1807B857dc33518D1C5aD)
- [Contract reference](CONSULT_ESCROW_SPEC.md)
- [Deployment record](../docs/deployments.md)
- [Security notes](../docs/security.md)

The application is offline and the repository is not maintained. Reuse with
real funds requires a new review and deployment process.
