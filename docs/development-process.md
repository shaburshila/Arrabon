# Development process

Arrabon was built by one developer from March 26 to May 21, 2026. The active
development history contains 225 commits across 57 calendar days.

The work covered product definition, user flows, mobile UX, frontend, backend,
database design, a USDC escrow contract, compliance controls, testing, and
deployment preparation.

## AI-assisted work

AI was used to:

- break the product into product, application, contract, data, compliance, and
  deployment work;
- draft interface contracts and failure cases;
- implement and revise code;
- expand tests around state transitions and access control;
- review inconsistencies between documents and implementation;
- investigate failing checks and integration behavior.

Generated output was not accepted as proof. Source code, contract behavior,
tests, migrations, and end-to-end flows determined whether a change was kept.

## Work structure

| Area | Responsibility |
|---|---|
| Product | Actors, link rules, deal lifecycle, dispute behavior |
| Frontend | Mobile UI, wallet flows, dashboards, admin screens |
| Backend | Route Handlers, services, validation, auth, encryption |
| Data | PostgreSQL schema, repositories, idempotency, audit records |
| Contract | USDC custody, authorization, states, payout and refund |
| Compliance | Provider composition, denylist, risk state, payout holds |
| Operations | Worker, RPC recovery, deployment and smoke checks |

Interfaces were written down before cross-layer implementation. The critical
ones were the EIP-712 funding payload, contract events, link and deal states,
API ownership, database constraints, and compliance error model.

The repository previously included a large set of step-by-step AI plans and
progress logs. They were useful during implementation but described temporary
work assignments rather than the delivered product, so they were removed from
the public branch.

## Verification record

The final repository contains:

- 225 commits from one author during active development;
- 13 application pages;
- 28 API route files;
- 71 test files;
- 68 documented QA scenarios;
- 20 critical cross-layer invariants;
- a ConsultEscrow deployment on Base Mainnet.

The test suite covers unit, service, route, UI, API smoke, and contract layers.
Internal review covered the threat model, funding authorization, state
transitions, access control, compliance failure paths, indexing idempotency,
and payout holds.

No external audit claim is made.

## Current status

The end-to-end MVP was completed, but a commercial launch did not follow after
the product's marketing direction ended. The application is not hosted or
maintained. The repository remains public as a record of the work.
