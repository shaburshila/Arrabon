"use client";

import { useState } from "react";

interface CopyBtnProps {
  fullWidth?: boolean;
  text: string;
  label?: string;
}

export function CopyBtn({ fullWidth = false, text, label = "Copy" }: CopyBtnProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        alignItems: "center",
        background: copied ? "var(--success-muted)" : "var(--muted-bg)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        color: copied ? "var(--success)" : "var(--muted)",
        cursor: "pointer",
        display: "inline-flex",
        fontSize: 14,
        fontWeight: 500,
        gap: 4,
        minHeight: 44,
        padding: "0 12px",
        transition: "background 0.2s, color 0.2s",
        width: fullWidth ? "100%" : undefined,
      }}
      type="button"
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}
