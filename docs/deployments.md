# Deployments — Base Consult Link

> Version: 1.0 | Status: Актуален | Date: 2026-04-10
> Составил: Base Consult Link Team | Проверил: — | Утвердил: —

## Base Sepolia (testnet)

### ConsultEscrow — 2026-04-10

| Field | Value |
|---|---|
| Contract | `0xA39781a1e7369125012F9524D87B70198F3039fe` |
| Network | Base Sepolia (chainId 84532) |
| Deployer | `0x2d9DcbB363f6CF83597015aF51b990088D7E7795` |
| Treasury | `0x2d9DcbB363f6CF83597015aF51b990088D7E7795` |
| Admin wallets | `0x2d9DcbB363f6CF83597015aF51b990088D7E7795` |
| USDC | `0x735fa4f6D544DCBCE4f6767Ac09Cc12dFB86d43A` |
| Block | 40023915 |
| Tx hash | `0xe98e3dae5e14e771921f0bc2c7f70256bba9ed95f4f26435ae3aad1d828c722a` |
| Basescan | https://sepolia.basescan.org/address/0xA39781a1e7369125012F9524D87B70198F3039fe |

**Причина передеплоя:** добавлен конструкторный гард `require(initialAdmins.length > 0)` в рамках pre-testnet hardening pass.

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
| 1.0 | 2026-04-10 | Первичный выпуск; деплой ConsultEscrow на Base Sepolia (0xA39...39fe) |
