"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/icons";

const tabs = [
  { href: "/create",   icon: "utility-plus" as const,             label: "Create" },
  { href: "/my-deals", icon: "utility-wallet-connected" as const,  label: "Deals" },
  { href: "/my-links", icon: "utility-receipt" as const,           label: "Links" },
];

export function BottomTabBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href ||
    (href === "/my-deals" && pathname.startsWith("/deal")) ||
    (href === "/my-links" && pathname.startsWith("/link"));

  return (
    <nav aria-label="Primary mobile navigation" className="bottom-tabs">
      {tabs.map((t) => (
        <Link
          key={t.href}
          className={`bottom-tabs__item${isActive(t.href) ? " is-active" : ""}`}
          href={t.href}
        >
          <span className="bottom-tabs__icon">
            <Icon name={t.icon} size={20} />
          </span>
          <span className="bottom-tabs__label">{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
