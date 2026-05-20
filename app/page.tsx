"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";

import { Icon } from "@/components/icons";
import { AppShell } from "@/components/app/app-shell";
import { ArrabonSeal } from "@/components/shared/arrabon-seal";
import { Btn } from "@/components/shared/btn";

export default function HomePage() {
  return (
    <AppShell flushBottom maxWidth={1180}>
      <div style={homeStackStyle}>
        <HeroSection />
        <StepsSection />
        <BenefitsSection />
        <StatsSection />
        <FinalCtaSection />
        <SiteFooter />
      </div>
    </AppShell>
  );
}

function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const vh = window.innerHeight;
        const opacity = Math.max(0, 1 - y / (vh * 0.55));
        const translate = Math.min(80, y * 0.25);
        const scale = 1 - Math.min(0.025, (y / vh) * 0.025);
        if (heroRef.current) {
          heroRef.current.style.transform = `translate3d(0, ${-translate}px, 0) scale(${scale})`;
          heroRef.current.style.opacity = String(opacity);
        }
        if (hintRef.current) {
          const hintOp = Math.max(0, 1 - y / (vh * 0.06));
          hintRef.current.style.opacity = String(hintOp);
          hintRef.current.style.pointerEvents = hintOp < 0.05 ? "none" : "auto";
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="landing-hero-section" style={heroSectionInner}>
      <div className="landing-hero" ref={heroRef}>
        <div>
          <p style={eyebrowStyle}>Onchain Escrow · Base Network</p>
          <h1>
            Trusted settlement <br />
            for a single <span className="accent">consultation</span>.
          </h1>
          <p className="landing-hero__sub">
            Arrabon holds USDC in escrow on Base until your consultation is delivered.
            One link. One slot. Settlement on completion or dispute — never before.
          </p>
          <div className="landing-hero__cta">
            <Link href="/create" style={{ textDecoration: "none" }}>
              <Btn size="lg" variant="primary">
                Create consultation link
                <Icon name="utility-arrow-right" size={16} />
              </Btn>
            </Link>
            <Link href="/my-deals" style={{ textDecoration: "none" }}>
              <Btn size="lg" variant="ghost">View deals</Btn>
            </Link>
          </div>
        </div>
        <div className="landing-hero__seal">
          <ArrabonSeal size={320} tone="auto" />
        </div>
      </div>

      <button
        aria-label="Scroll to how it works"
        className="landing-scroll-hint"
        onClick={() => window.scrollTo({ top: window.innerHeight - 64, behavior: "smooth" })}
        ref={hintRef}
        type="button"
      >
        <span className="landing-scroll-hint__label">How it works</span>
        <span className="landing-scroll-hint__arrow">
          <Icon name="utility-chevron-down" size={14} />
        </span>
      </button>
    </section>
  );
}

function StepsSection() {
  return (
    <section className="landing-steps" style={fullBleedSection}>
      <div style={sectionInner}>
        <div className="stack-12" style={{ maxWidth: 720, marginBottom: 40 }}>
          <p style={eyebrowStyle}>How it works</p>
          <h2 style={sectionH2Style}>Three steps. One settlement.</h2>
        </div>
        <div style={threeColGrid}>
          {STEPS.map((s) => (
            <StepCard key={s.n} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}

function BenefitsSection() {
  return (
    <section className="landing-benefits" style={fullBleedSection}>
      <div style={sectionInner}>
        <div className="stack-12" style={{ maxWidth: 720, marginBottom: 40 }}>
          <p style={eyebrowStyle}>Built for both sides</p>
          <h2 style={sectionH2Style}>A safer workflow for paid consultations.</h2>
        </div>
        <div style={threeColGrid}>
          {BENEFITS.map((b) => (
            <BenefitCard key={b.title} {...b} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  return (
    <section className="landing-stats" style={fullBleedSection}>
      <div style={sectionInner}>
        <div className="stack-12" style={{ maxWidth: 720, marginBottom: 40 }}>
          <p style={eyebrowStyle}>Results to date</p>
          <h2 style={sectionH2Style}>Numbers from the network.</h2>
        </div>
        <div className="landing-stats__grid">
          {STATS.map((s) => (
            <div key={s.label}>
              <span className="landing-stat__num">{s.num}</span>
              <span className="landing-stat__label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section className="landing-cta" style={fullBleedSection}>
      <div className="landing-cta__inner" style={{ paddingTop: 0 }}>
        <div className="landing-cta__seal">
          <ArrabonSeal size={56} tone="auto" />
        </div>
        <h2 className="landing-cta__title">
          Ready to create your first{" "}
          <span className="accent">consultation link?</span>
        </h2>
        <div className="landing-cta__actions">
          <Link href="/create" style={{ textDecoration: "none" }}>
            <Btn size="lg" variant="primary">Create your first link</Btn>
          </Link>
        </div>
        <div className="landing-cta__trust">
          {TRUST_ITEMS.map((t) => (
            <span className="landing-cta__trust-item" key={t.label}>
              <Icon name="utility-secure-subtle" size={13} />
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer" style={footerSectionStyle}>
      <div style={{ ...sectionInner, paddingTop: 32, paddingBottom: 24 }}>
        <div className="site-footer__grid">
          <div className="stack-12">
            <span style={brandStyle}>
              <span style={brandWordStyle}>Arrabon</span>
            </span>
            <p style={footerTagStyle}>
              Onchain escrow for a single scheduled consultation. Settlement in USDC on Base.
            </p>
          </div>
          <div className="stack-12">
            <p style={footerHeadStyle}>Product</p>
            <div className="stack-8">
              <Link href="/create" className="site-footer__link">Create link</Link>
              <Link href="/my-links" className="site-footer__link">My links</Link>
              <Link href="/my-deals" className="site-footer__link">My deals</Link>
            </div>
          </div>
          <div className="stack-12">
            <p style={footerHeadStyle}>Network</p>
            <div className="stack-8">
              <a
                className="site-footer__link"
                href="https://basescan.org/address/0x2EB0e35AbF9035f7A3B1807B857dc33518D1C5aD"
                rel="noreferrer"
                target="_blank"
              >
                Contract on Basescan
              </a>
            </div>
          </div>
          <div className="stack-12">
            <p style={footerHeadStyle}>Legal</p>
            <div className="stack-8">
              <Link href="/terms" className="site-footer__link">Terms</Link>
              <Link href="/privacy" className="site-footer__link">Privacy</Link>
              <Link href="/refund-policy" className="site-footer__link">Refund policy</Link>
              <Link href="/compliance" className="site-footer__link">Compliance</Link>
            </div>
          </div>
        </div>
        <div className="site-footer__base">
          <span style={footerCopyStyle}>© 2026 Arrabon · Onchain settlement on Base</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ArrabonSeal size={20} tone="gold-line" />
            <span style={footerCopyStyle}>Trusted escrow</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

function StepCard({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div style={cardStyle}>
      <div className="stack-12">
        <span style={eyebrowStyle}>{n}</span>
        <h3 style={cardTitleStyle}>{title}</h3>
        <p style={cardDescStyle}>{desc}</p>
      </div>
    </div>
  );
}

function BenefitCard({
  icon,
  tone,
  title,
  desc,
}: {
  icon: "utility-user" | "utility-wallet-connected" | "utility-secure-subtle";
  tone: string;
  title: string;
  desc: string;
}) {
  return (
    <div style={cardStyle}>
      <div className="stack-12">
        <span className={`status-icon status-icon--md status-icon--${tone}`} style={{ marginBottom: 4 }}>
          <Icon name={icon} size={18} />
        </span>
        <h3 style={cardTitleStyle}>{title}</h3>
        <p style={cardDescStyle}>{desc}</p>
      </div>
    </div>
  );
}

/* ─── Static data ──────────────────────────────────────────────────── */

const STEPS = [
  {
    n: "01",
    title: "Create link",
    desc: "Set title, price in USDC, scheduled time and a private meeting URL. One link, one slot.",
  },
  {
    n: "02",
    title: "Buyer funds escrow",
    desc: "Buyer pays USDC into the Arrabon contract on Base. The meeting URL is revealed only after funding.",
  },
  {
    n: "03",
    title: "Settle on completion",
    desc: "After the consultation, the buyer releases payment or opens a dispute. Auto-release if neither happens.",
  },
];

const BENEFITS = [
  {
    icon: "utility-user" as const,
    tone: "gold",
    title: "For sellers",
    desc: "Get paid for your time — no upfront trust required. Buyer locks funds before the call, you settle after. No chargebacks, no risk of unpaid work.",
  },
  {
    icon: "utility-wallet-connected" as const,
    tone: "green",
    title: "For buyers",
    desc: "Pay only if the consultation actually happens. If the seller no-shows or something goes wrong, open a dispute and get reviewed by a neutral admin.",
  },
  {
    icon: "utility-secure-subtle" as const,
    tone: "gold",
    title: "Neutral dispute review",
    desc: "When buyer and seller disagree, an appointed neutral admin reviews the case and decides — neither side has to escalate alone.",
  },
];

const STATS = [
  { num: "1,284", label: "Deals settled" },
  { num: "$3.42M", label: "Total USDC settled" },
  { num: "99.4%", label: "Released without dispute" },
];

const TRUST_ITEMS = [
  { label: "Built on Base" },
  { label: "Wallet-signed actions" },
  { label: "Neutral dispute review" },
];

/* ─── Styles ────────────────────────────────────────────────────────── */

const homeStackStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 0,
};

const heroSectionInner = {
  boxSizing: "border-box" as const,
  marginLeft: "calc(50% - 50vw)",
  marginRight: "calc(50% - 50vw)",
  paddingLeft: "calc(50vw - 50% + 16px)",
  paddingRight: "calc(50vw - 50% + 16px)",
  width: "auto",
};

const fullBleedSection = {
  boxSizing: "border-box" as const,
  marginLeft: "calc(50% - 50vw)",
  marginRight: "calc(50% - 50vw)",
  padding: "64px calc(50vw - 50% + 16px)",
  width: "auto",
};

const footerSectionStyle = {
  boxSizing: "border-box" as const,
  marginLeft: "calc(50% - 50vw)",
  marginRight: "calc(50% - 50vw)",
  padding: "32px calc(50vw - 50% + 16px) 16px",
  width: "auto",
};

const sectionInner = {
  margin: "0 auto",
  maxWidth: 1180,
  paddingLeft: 16,
  paddingRight: 16,
  width: "100%",
};

const eyebrowStyle = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  margin: 0,
  textTransform: "uppercase" as const,
};

const sectionH2Style = {
  fontFamily: "var(--font-serif)",
  fontSize: "clamp(28px, 4vw, 44px)",
  fontWeight: 500,
  letterSpacing: "-0.015em",
  lineHeight: 1.1,
  color: "var(--ink)",
  margin: 0,
};

const threeColGrid = {
  display: "grid",
  gap: 20,
  gridTemplateColumns: "repeat(3, 1fr)",
} as const;

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-4)",
  padding: "28px 24px",
};

const cardTitleStyle = {
  fontFamily: "var(--font-serif)",
  fontSize: 22,
  fontWeight: 500,
  letterSpacing: "-0.005em",
  color: "var(--ink)",
  margin: 0,
};

const cardDescStyle = {
  color: "var(--muted)",
  fontSize: 13.5,
  lineHeight: 1.65,
  margin: 0,
};

const brandStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const brandWordStyle = {
  fontFamily: "var(--font-serif)",
  fontSize: 22,
  fontWeight: 500,
  color: "var(--ink)",
  letterSpacing: "0.005em",
};

const footerTagStyle = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.6,
  margin: 0,
  maxWidth: "32ch",
};

const footerHeadStyle = {
  color: "var(--muted-2)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  margin: 0,
  textTransform: "uppercase" as const,
};

const footerCopyStyle = {
  color: "var(--muted-2)",
  fontSize: 12,
};
