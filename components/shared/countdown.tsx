"use client";

import { useEffect, useState } from "react";

interface Props {
  expiredLabel?: string;
  prefix?: string;
  to: number | string;
}

export function Countdown({ to, prefix = "in", expiredLabel = "now" }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const target = typeof to === "string" ? new Date(to).getTime() : to;
  const diff = target - now;

  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return <span>{expiredLabel}</span>;

  const sec = Math.floor(diff / 1000) % 60;
  const min = Math.floor(diff / 60_000) % 60;
  const hr = Math.floor(diff / 3_600_000) % 24;
  const day = Math.floor(diff / 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");

  const str =
    day > 0
      ? `${day}d ${pad(hr)}h ${pad(min)}m`
      : hr > 0
        ? `${pad(hr)}:${pad(min)}:${pad(sec)}`
        : `${pad(min)}:${pad(sec)}`;

  return (
    <span>
      {prefix && `${prefix} `}
      <span className="mono">{str}</span>
    </span>
  );
}
