import type { ChangeEvent } from "react";

export function TokenAmountRow({
  amount,
  label,
  onChange,
  readonly = false,
  sublabel,
  token = "USDC",
}: {
  amount: number | string;
  label?: string;
  onChange?: (value: string) => void;
  readonly?: boolean;
  sublabel?: string;
  token?: string;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event.target.value);
  }

  return (
    <div style={rowStyle}>
      <div style={amountColumnStyle}>
        {label && <p style={labelStyle}>{label}</p>}
        {readonly ? (
          <p style={amountStyle}>{amount}</p>
        ) : (
          <input
            inputMode="decimal"
            onChange={handleChange}
            placeholder="0"
            style={amountInputStyle}
            type="number"
            value={amount}
          />
        )}
        {sublabel && <p style={sublabelStyle}>{sublabel}</p>}
      </div>
      <div style={tokenStyle}>
        <span style={tokenIconStyle}>$</span>
        <span style={tokenTextStyle}>{token}</span>
      </div>
    </div>
  );
}

const rowStyle = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const amountColumnStyle = {
  flex: 1,
  minWidth: 0,
};

const labelStyle = {
  color: "var(--muted)",
  fontSize: 12,
  margin: "0 0 4px",
};

const amountStyle = {
  color: "var(--foreground)",
  fontSize: 32,
  fontWeight: 600,
  lineHeight: 1.1,
  margin: 0,
};

const amountInputStyle = {
  background: "transparent",
  border: "none",
  color: "var(--foreground)",
  fontSize: 32,
  fontWeight: 600,
  lineHeight: 1.1,
  outline: "none",
  padding: 0,
  width: "100%",
};

const sublabelStyle = {
  color: "var(--muted)",
  fontSize: 12,
  margin: "4px 0 0",
};

const tokenStyle = {
  alignItems: "center",
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  display: "inline-flex",
  flexShrink: 0,
  gap: 6,
  padding: "8px 12px",
};

const tokenIconStyle = {
  alignItems: "center",
  background: "#2775ca",
  borderRadius: "50%",
  color: "#fff",
  display: "inline-flex",
  fontSize: 10,
  fontWeight: 800,
  height: 20,
  justifyContent: "center",
  width: 20,
};

const tokenTextStyle = {
  color: "var(--foreground)",
  fontSize: 14,
  fontWeight: 600,
};
