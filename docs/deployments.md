# Deployments — Arrabon

> Version: 1.3 | Status: Актуален | Date: 2026-05-18
> Составил: Arrabon Team | Проверил: — | Утвердил: —

## Base Sepolia (testnet)

### ConsultEscrow — 2026-05-18 (актуальный)

| Field | Value |
|---|---|
| Contract | `0xC97C7c68E397C5eB18fE8EEF6B137F6C03d8A5B5` |
| Network | Base Sepolia (chainId 84532) |
| Deployer | `0x2d9DcbB363f6CF83597015aF51b990088D7E7795` |
| Treasury | `0x2d9DcbB363f6CF83597015aF51b990088D7E7795` |
| Owner | `0xe603e49a9DE278651E1bDd8E3897F0DfD4c306bF` |
| Admin wallets | `0x2d9DcbB363f6CF83597015aF51b990088D7E7795`, `0x3Bf41Dc34754341B38D721a3A715025958769bb4` |
| FundingAuthorizer | `0x3Bf41Dc34754341B38D721a3A715025958769bb4` |
| USDC | `0x735fa4f6D544DCBCE4f6767Ac09Cc12dFB86d43A` |
| Block | 41671483 |
| Tx hash | `0x052d2488b09fd08a93aa608274c4114b5e85e473b7f49e7256c65215b32db187` |
| Basescan | https://sepolia.basescan.org/address/0xC97C7c68E397C5eB18fE8EEF6B137F6C03d8A5B5 |

**Причина передеплоя:** сохранена новая fee-модель и лимит `$100,000`, дополнительно возвращён onchain dispute window на `48 hours` вместо временного тестового значения `1 minute`.

---

### ConsultEscrow — 2026-05-18 (устарел)

| Field | Value |
|---|---|
| Contract | `0xbDC4b9C6dbFb494C46eAa39863F10ee05F9FE382` |
| Network | Base Sepolia (chainId 84532) |
| Deployer | `0x2d9DcbB363f6CF83597015aF51b990088D7E7795` |
| Treasury | `0x2d9DcbB363f6CF83597015aF51b990088D7E7795` |
| Owner | `0xe603e49a9DE278651E1bDd8E3897F0DfD4c306bF` |
| Admin wallets | `0x2d9DcbB363f6CF83597015aF51b990088D7E7795`, `0x3Bf41Dc34754341B38D721a3A715025958769bb4` |
| FundingAuthorizer | `0x3Bf41Dc34754341B38D721a3A715025958769bb4` |
| USDC | `0x735fa4f6D544DCBCE4f6767Ac09Cc12dFB86d43A` |
| Block | 41667560 |
| Tx hash | `0xd4a0fdc9dce646d38185f8c8e6a6975f67c9e9014b6698627820281791ab8650` |
| Basescan | https://sepolia.basescan.org/address/0xbDC4b9C6dbFb494C46eAa39863F10ee05F9FE382 |

**Статус:** **Не использовать** — заменён повторным деплоем от 2026-05-18, который возвращает onchain dispute window к `48 hours`.

---

### ConsultEscrow — 2026-05-11 (устарел)

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

**Статус:** **Не использовать** — заменён деплоем от 2026-05-18 с новой fee-моделью и лимитом цены `$100,000`.

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
| 1.3 | 2026-05-18 | Повторный передеплой ConsultEscrow (0xC97...A5B5); onchain dispute window возвращён на `48 hours`, обновлены env-указатели адреса и стартового блока |
| 1.2 | 2026-05-18 | Передеплой ConsultEscrow (0xbDC...E382); новая fee-модель `price + fee`, clamp `3% / min $1.50 / max $30`, `MAX_PRICE = $100,000` |
| 1.1 | 2026-05-11 | Передеплой ConsultEscrow (0x947...157); исправлен `InvalidSchedule` при `expires_at == scheduled_at` |
| 1.0 | 2026-04-10 | Первичный выпуск; деплой ConsultEscrow на Base Sepolia (0xA39...39fe) |
