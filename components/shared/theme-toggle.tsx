"use client";

import { useLayoutEffect, useState } from "react";

type Theme = "light" | "dark";

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem("theme");
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("theme", theme);
  } catch {}
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useLayoutEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    const applied = attr === "light" || attr === "dark" ? attr : null;
    const stored = getStoredTheme();
    const resolved = applied ?? stored ?? getSystemTheme();
    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  if (theme === null) return null;

  return (
    <button
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
      style={btnStyle}
      type="button"
    >
      {theme === "dark" ? "☀" : "☽"}
    </button>
  );
}

const btnStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--muted)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  fontSize: 16,
  height: 36,
  lineHeight: 1,
  padding: 0,
  width: 36,
} as const;
