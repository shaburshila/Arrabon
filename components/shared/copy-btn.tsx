"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";

interface CopyBtnProps {
  fullWidth?: boolean;
  label?: string;
  text: string;
}

export function CopyBtn({ fullWidth = false, text, label = "Copy" }: CopyBtnProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  };

  return (
    <div
      className="copy-field"
      style={fullWidth ? { width: "100%" } : undefined}
    >
      <span className="copy-field__value">{text}</span>
      <button
        className="copy-field__btn"
        type="button"
        onClick={handleCopy}
      >
        <Icon
          name={copied ? "utility-check" : "utility-copy-address"}
          size={13}
        />
        {copied ? "Copied" : label}
      </button>
    </div>
  );
}
