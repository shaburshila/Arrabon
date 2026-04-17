import type { InputHTMLAttributes } from "react";

export function TextInput({
  style,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        ...inputStyle,
        ...style,
      }}
    />
  );
}

const inputStyle = {
  background: "var(--input-bg)",
  border: "1px solid var(--input-border)",
  borderRadius: "var(--radius)",
  color: "var(--foreground)",
  fontSize: 16,
  fontWeight: 400,
  minHeight: 48,
  outline: "none",
  padding: "0 14px",
  width: "100%",
};
