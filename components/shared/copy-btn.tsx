"use client";

import { useState } from "react";

interface CopyBtnProps {
  text: string;
  label?: string;
}

export function CopyBtn({ text, label = "Copy" }: CopyBtnProps) {
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
        borderRadius: 8,
        color: copied ? "var(--success)" : "var(--muted)",
        cursor: "pointer",
        display: "inline-flex",
        fontSize: 13,
        fontWeight: 500,
        gap: 4,
        minHeight: 44,
        padding: "0 12px",
        transition: "background 0.2s, color 0.2s",
      }}
      type="button"
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}
