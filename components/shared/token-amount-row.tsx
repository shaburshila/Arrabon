import type { ChangeEvent } from "react";

export function TokenAmountRow({
  amount,
  label,
  onChange,
  readonly = false,
  required = false,
  sublabel,
  token = "USDC",
}: {
  amount: number | string;
  label?: string;
  onChange?: (value: string) => void;
  readonly?: boolean;
  required?: boolean;
  sublabel?: string;
  token?: string;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event.target.value);
  }

  return (
    <div style={fieldStyle}>
      {label && <span className="field__label">{label}</span>}
      <div className="amount-input">
        {readonly ? (
          <span style={readonlyAmountStyle}>{amount}</span>
        ) : (
          <input
            inputMode="decimal"
            onChange={handleChange}
            placeholder="0.00"
            required={required}
            type="number"
            value={amount}
          />
        )}
        <span className="amount-input__token">{token}</span>
      </div>
      {sublabel && <span className="field__help">{sublabel}</span>}
    </div>
  );
}

const fieldStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
};

const readonlyAmountStyle = {
  alignItems: "center",
  color: "var(--ink)",
  display: "inline-flex",
  fontFamily: "var(--font-serif)",
  fontSize: 28,
  fontWeight: 500,
  height: 56,
  letterSpacing: "-0.01em",
  padding: "0 16px",
};
