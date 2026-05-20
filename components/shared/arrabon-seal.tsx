"use client";

import { useEffect, useState } from "react";

interface Props {
  size?: number;
  tone?: "gold-on-graphite" | "graphite-on-ivory" | "gold-line" | "ink-line" | "auto";
}

export function ArrabonSeal({ size = 80, tone = "auto" }: Props) {
  const [theme, setTheme] = useState<string>("light");

  useEffect(() => {
    const el = document.documentElement;
    setTheme(el.dataset.theme ?? "light");
    const obs = new MutationObserver(() =>
      setTheme(el.dataset.theme ?? "light"),
    );
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const resolved =
    tone === "auto"
      ? theme === "dark"
        ? "graphite-on-ivory"
        : "gold-on-graphite"
      : tone;

  const src: Record<string, string> = {
    "gold-on-graphite": "/arrabon-seal-gold-on-graphite.svg",
    "graphite-on-ivory": "/arrabon-seal-graphite-on-ivory.svg",
    "gold-line": "/arrabon-seal-one-color-gold.svg",
    "ink-line": "/arrabon-seal-one-color-black.svg",
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt="Arrabon Seal"
      height={size}
      src={src[resolved]}
      width={size}
    />
  );
}
