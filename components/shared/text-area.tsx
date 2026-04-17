import type { TextareaHTMLAttributes } from "react";

export function TextArea({
  style,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        ...textareaStyle,
        ...style,
      }}
    />
  );
}

const textareaStyle = {
  background: "var(--input-bg)",
  border: "1px solid var(--input-border)",
  borderRadius: "var(--radius)",
  color: "var(--foreground)",
  fontSize: 16,
  fontWeight: 400,
  minHeight: 120,
  outline: "none",
  padding: 14,
  resize: "vertical" as const,
  width: "100%",
};
