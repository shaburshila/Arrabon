# Deployments — Base Consult Link

> Version: 1.1 | Status: Актуален | Date: 2026-05-11
> Составил: Base Consult Link Team | Проверил: — | Утвердил: —

## Base Sepolia (testnet)

### ConsultEscrow — 2026-05-11 (актуальный)

| Field | Value |
|---|---|
| Contract | `0x947f67f6083bE848C2C8aCd30ddD2cEf6232A157` |
| Network | Base Sepolia (chainId 84532) |
| Deployer | `0x2d9DcbB363f6CF83597015aF51b990088D7E7795` |
| Treasury | `0x2d9DcbB363f6CF83597015aF51b990088D7E7795` |
| Admin wallets | `0x2d9DcbB363f6CF83597015aF51b990088D7E7795` |
| FundingAuthorizer | `0x3Bf41Dc34754341B38D721a3A715025958769bb4` |
| USDC | `0x735fa4f6D544DCBCE4f6767Ac09Cc12dFB86d43A` |
| Block | 41359822 |
| Tx hash | `0x5408ad9a58be3829fd053c0dd9367148280df7a58fc731bcabc6293a0a78c7ea` |
| Basescan | https://sepolia.basescan.org/address/0x947f67f6083bE848C2C8aCd30ddD2cEf6232A157 |

**Причина передеплоя:** исправлен баг в проверке расписания — `link_expires_at >= scheduled_at` заменено на `link_expires_at > scheduled_at`, чтобы разрешить оплату ссылки вплоть до момента начала консультации.

---

### ConsultEscrow — 2026-04-10 (устарел)

| Field | Value |
|---|---|
| Contract | `0xA39781a1e7369125012F9524D87B70198F3039fe` |
| Block | 40023915 |
| Tx hash | `0xe98e3dae5e14e771921f0bc2c7f70256bba9ed95f4f26435ae3aad1d828c722a` |
| Статус | **Не использовать** — содержит баг `InvalidSchedule` при `expires_at == scheduled_at` |

---

### ConsultEscrow — предыдущий (устарел)

| Field | Value |
|---|---|
| Contract | `0x21C95255228939ce6CBE0c20FD491bd281f83bfD` |
| Статус | **Не использовать** — байткод без гарда admins |

---

## Лист регистрации изменений

| Версия | Дата | Изменения |
|---|---|---|
| 1.1 | 2026-05-11 | Передеплой ConsultEscrow (0x947...157); исправлен `InvalidSchedule` при `expires_at == scheduled_at` |
| 1.0 | 2026-04-10 | Первичный выпуск; деплой ConsultEscrow на Base Sepolia (0xA39...39fe) |
