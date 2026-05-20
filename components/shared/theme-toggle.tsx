"use client";

import { useLayoutEffect, useState } from "react";
import { Icon } from "@/components/icons";

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
      <Icon name={theme === "dark" ? "utility-theme-light" : "utility-theme-dark"} size={15} />
    </button>
  );
}

const btnStyle = {
  alignItems: "center",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  color: "var(--muted)",
  cursor: "pointer",
  display: "inline-flex",
  flexShrink: 0,
  height: 34,
  justifyContent: "center",
  padding: 0,
  width: 34,
} as const;
