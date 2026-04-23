"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  Link2,
  Lock,
  Plus,
  Shield,
  User,
} from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { useWalletSession } from "@/hooks/use-wallet-session";

const howItWorksCards = [
  {
    description: "Set your price, schedule, and private meeting URL. Share the link with your buyer.",
    icon: Plus,
    iconBg: "var(--accent-soft)",
    iconColor: "var(--accent)",
    number: 1,
    title: "Create your link",
  },
  {
    description: "The buyer pays USDC on Base. Funds stay locked in the escrow contract while the consultation is pending.",
    icon: Shield,
    iconBg: "rgba(34, 197, 94, 0.1)",
    iconColor: "var(--success)",
    number: 2,
    title: "Buyer pays into escrow",
  },
  {
    description: "After the consultation, funds can be released, refunded, auto-released, or reviewed during a dispute.",
    icon: Check,
    iconBg: "var(--accent-muted)",
    iconColor: "var(--accent)",
    number: 3,
    title: "Release, refund, or review",
  },
] as const;

const benefitCards = [
  {
    description: "Create private paid links, keep meeting URLs hidden until funding, and receive USDC after confirmation or resolution.",
    icon: Link2,
    iconBg: "var(--accent-soft)",
    iconColor: "var(--accent)",
    title: "For sellers",
  },
  {
    description: "Pay into escrow, recover paid consultations from My deals, and open a dispute if something goes wrong.",
    icon: User,
    iconBg: "rgba(34, 197, 94, 0.1)",
    iconColor: "var(--success)",
    title: "For buyers",
  },
  {
    description: "Disputed consultations can be reviewed by an appointed neutral admin before funds are released or refunded.",
    icon: Shield,
    iconBg: "var(--accent-muted)",
    iconColor: "var(--accent)",
    title: "Neutral dispute review",
  },
] as const;

const footerLinks = [
  "Docs",
  "Terms",
  "Privacy",
  "Contact",
  "GitHub",
  "Contract on Basescan",
] as const;

export default function HomePage() {
  const session = useWalletSession();
  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    function handleScroll() {
      setShowScrollHint(window.scrollY < 24);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <AppShell flushBottom maxWidth={1120} session={session}>
      <div style={homeStackStyle}>
        <HeroSection />
        <ScrollHint visible={showScrollHint} />
        <HowItWorksSection />
        <BenefitsSection />
        <FinalCtaSection />
        <HomeFooter />
      </div>
    </AppShell>
  );
}

function ScrollHint({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      style={{
        ...scrollHintStyle,
        opacity: visible ? 1 : 0,
        pointerEvents: "none",
        transform: visible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(8px)",
      }}
    >
      <span style={scrollHintFloatStyle}>
        <span>Scroll to learn more</span>
        <span style={scrollHintIconStyle}>
          <ChevronDown size={14} />
          <ChevronDown size={14} />
          <ChevronDown size={14} />
        </span>
      </span>
    </div>
  );
}

function HeroSection() {
  return (
    <section style={heroStyle}>
      <div style={heroCopyStyle}>
        <div style={badgeStyle}>
          <SparkleIcon />
          <span>Secured by Base</span>
        </div>

        <h1 style={heroTitleStyle}>
          Get paid for your{" "}
          <span style={heroTitleAccentStyle}>expertise</span>
        </h1>

        <p style={heroSubtitleStyle}>
          Create a secure payment link. Share it. Get paid only when the consultation happens.
        </p>

        <div style={heroActionsStyle}>
          <CtaLink href="/create" variant="primary">
            Create a link
          </CtaLink>
          <CtaLink href="#how-it-works" variant="secondary">
            How it works
          </CtaLink>
        </div>

        <div style={trustLineStyle}>
          <Lock size={12} />
          <span>Funds held on-chain · Wallet-signed actions · Base L2</span>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" style={sectionStyle}>
      <SectionHeader
        eyebrow="How it works"
        title="Three steps. That's it."
      />
      <div style={threeCardGridStyle}>
        {howItWorksCards.map((card) => (
          <InfoCard
            description={card.description}
            icon={<card.icon size={20} />}
            iconBg={card.iconBg}
            iconColor={card.iconColor}
            key={card.title}
            marker={card.number}
            title={card.title}
          />
        ))}
      </div>
    </section>
  );
}

function BenefitsSection() {
  return (
    <section style={{ ...fullBleedSectionStyle, background: "var(--muted-bg)" }}>
      <div style={fullBleedInnerStyle}>
        <SectionHeader
          eyebrow="Built for both sides"
          title="A safer workflow for paid consultations"
        />
        <div style={threeCardGridStyle}>
          {benefitCards.map((card) => (
            <InfoCard
              description={card.description}
              icon={<card.icon size={22} />}
              iconBg={card.iconBg}
              iconColor={card.iconColor}
              key={card.title}
              title={card.title}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section style={finalCtaStyle}>
      <div style={finalCtaGradientStyle} />
      <div style={finalCtaInnerStyle}>
        <h2 style={finalCtaTitleStyle}>Ready to create your first consultation link?</h2>
        <p style={finalCtaSubtitleStyle}>
          Set the terms, share the link, and let the buyer fund escrow on Base.
        </p>
        <CtaLink href="/create" variant="primary">
          Create your first link
        </CtaLink>
        <div style={trustIndicatorsStyle}>
          <TrustIndicator label="Built on Base" />
          <TrustIndicator label="Wallet-signed actions" />
          <TrustIndicator label="Neutral dispute review" />
        </div>
      </div>
    </section>
  );
}

function HomeFooter() {
  return (
    <footer style={footerStyle}>
      <div style={footerInnerStyle}>
        <nav aria-label="Footer links" style={footerLinksStyle}>
          {footerLinks.map((label) => (
            <FooterLink href="#" key={label}>
              {label}
            </FooterLink>
          ))}
        </nav>
        <div style={footerBottomStyle}>
          <p style={footerTextStyle}>
            Base Consult Link · Built on Base · Consultation escrow workflow
          </p>
          <p style={footerDisclaimerStyle}>
            Users are responsible for complying with applicable laws and platform terms.
          </p>
        </div>
      </div>
    </footer>
  );
}

function SectionHeader({
  eyebrow,
  subtitle,
  title,
}: {
  eyebrow: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <div style={sectionHeaderStyle}>
      <p style={sectionEyebrowStyle}>{eyebrow}</p>
      <h2 style={sectionTitleStyle}>{title}</h2>
      {subtitle && <p style={sectionSubtitleStyle}>{subtitle}</p>}
    </div>
  );
}

function InfoCard({
  compact = false,
  description,
  icon,
  iconBg,
  iconColor,
  marker,
  title,
}: {
  compact?: boolean;
  description: string;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  marker?: number;
  title: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...infoCardStyle,
        minHeight: compact ? 0 : 220,
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      {marker && <span style={cardMarkerStyle}>{marker}</span>}
      <span style={{ ...cardIconStyle, background: iconBg, color: iconColor }}>
        {icon}
      </span>
      <h3 style={cardTitleStyle}>{title}</h3>
      <p style={cardDescriptionStyle}>{description}</p>
    </article>
  );
}

function CtaLink({
  children,
  href,
  variant,
}: {
  children: ReactNode;
  href: string;
  variant: "primary" | "secondary";
}) {
  const [hovered, setHovered] = useState(false);
  const isPrimary = variant === "primary";

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...ctaLinkBaseStyle,
        background: isPrimary
          ? hovered
            ? "var(--accent-strong)"
            : "var(--accent)"
          : hovered
            ? "var(--panel-hover)"
            : "transparent",
        border: isPrimary ? "1px solid transparent" : "1px solid var(--border)",
        color: isPrimary ? "#fff" : "var(--foreground)",
        minWidth: 160,
        transform: hovered && isPrimary ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      <span style={ctaContentStyle}>{children}</span>
    </Link>
  );
}

function TrustIndicator({ label }: { label: string }) {
  return (
    <span style={trustIndicatorStyle}>
      <SparkleIcon />
      {label}
    </span>
  );
}

function FooterLink({ children, href }: { children: ReactNode; href: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...footerLinkStyle,
        opacity: hovered ? 0.7 : 1,
      }}
    >
      {children}
    </a>
  );
}

function SparkleIcon() {
  return (
    <svg aria-hidden height="12" viewBox="0 0 12 12" width="12">
      <path d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5L6 0Z" fill="currentColor" />
    </svg>
  );
}

const homeStackStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 0,
};

const scrollHintStyle = {
  alignItems: "center",
  bottom: 56,
  color: "var(--muted)",
  display: "inline-flex",
  flexDirection: "column" as const,
  fontSize: 14,
  fontWeight: 500,
  gap: 4,
  lineHeight: 1.2,
  left: "50%",
  position: "fixed" as const,
  textDecoration: "none",
  transform: "translateX(-50%)",
  transition: "opacity 0.18s, transform 0.18s",
  zIndex: 20,
};

const scrollHintFloatStyle = {
  alignItems: "center",
  animation: "scrollHintFloat 2.2s ease-in-out infinite",
  display: "inline-flex",
  flexDirection: "column" as const,
  gap: 4,
};

const scrollHintIconStyle = {
  display: "inline-flex",
  gap: 2,
};

const heroStyle = {
  alignItems: "center",
  display: "flex",
  justifyContent: "center",
  minHeight: "calc(100vh - 136px)",
  padding: "0 0 24px",
  textAlign: "center" as const,
};

const heroCopyStyle = {
  alignItems: "center",
  display: "flex",
  flexDirection: "column" as const,
  gap: 20,
  maxWidth: 760,
  transform: "translateY(-10vh)",
  width: "100%",
};

const badgeStyle = {
  alignItems: "center",
  alignSelf: "center",
  background: "var(--accent-muted)",
  borderRadius: 999,
  color: "var(--accent)",
  display: "inline-flex",
  fontSize: 12,
  fontWeight: 500,
  gap: 8,
  padding: "6px 12px",
};

const heroTitleStyle = {
  color: "var(--foreground)",
  fontSize: "clamp(32px, 5vw, 42px)",
  fontWeight: 800,
  letterSpacing: "-0.02em",
  lineHeight: 1.2,
  margin: 0,
  whiteSpace: "nowrap" as const,
};

const heroTitleAccentStyle = {
  background: "linear-gradient(135deg, var(--accent) 0%, var(--success) 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

const heroSubtitleStyle = {
  color: "var(--muted)",
  fontSize: 15,
  lineHeight: 1.6,
  margin: 0,
  maxWidth: 380,
};

const heroActionsStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 12,
  justifyContent: "center",
};

const trustLineStyle = {
  alignItems: "center",
  color: "var(--muted)",
  display: "flex",
  flexWrap: "wrap" as const,
  fontSize: 12,
  gap: 8,
  justifyContent: "center",
};

const sectionStyle = {
  padding: "72px 0",
  width: "100%",
};

const fullBleedSectionStyle = {
  boxSizing: "border-box" as const,
  display: "flex",
  justifyContent: "center",
  marginLeft: "calc(50% - 50vw)",
  marginRight: "calc(50% - 50vw)",
  padding: "96px 16px",
  width: "auto",
};

const fullBleedInnerStyle = {
  margin: "0 auto",
  maxWidth: 1120,
  width: "100%",
};

const sectionHeaderStyle = {
  alignItems: "center",
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
  marginBottom: 40,
  textAlign: "center" as const,
  width: "100%",
};

const sectionEyebrowStyle = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.08em",
  margin: 0,
  textTransform: "uppercase" as const,
};

const sectionTitleStyle = {
  color: "var(--foreground)",
  fontSize: 22,
  fontWeight: 700,
  lineHeight: 1.25,
  margin: 0,
};

const sectionSubtitleStyle = {
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.6,
  margin: 0,
  maxWidth: 560,
};

const threeCardGridStyle = {
  display: "grid",
  gap: 24,
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  width: "100%",
};

const infoCardStyle = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-panel)",
  display: "flex",
  flexDirection: "column" as const,
  padding: 24,
  position: "relative" as const,
  transition: "transform 0.2s",
};

const cardMarkerStyle = {
  alignItems: "center",
  background: "var(--muted-bg)",
  borderRadius: "50%",
  color: "var(--muted)",
  display: "inline-flex",
  fontSize: 12,
  fontWeight: 600,
  height: 24,
  justifyContent: "center",
  position: "absolute" as const,
  right: 16,
  top: 16,
  width: 24,
};

const cardIconStyle = {
  alignItems: "center",
  borderRadius: "var(--radius-sm)",
  display: "inline-flex",
  flexShrink: 0,
  height: 44,
  justifyContent: "center",
  marginBottom: 16,
  width: 44,
};

const cardTitleStyle = {
  color: "var(--foreground)",
  fontSize: 15,
  fontWeight: 600,
  margin: "0 0 8px",
};

const cardDescriptionStyle = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.6,
  margin: 0,
};

const finalCtaStyle = {
  alignItems: "center",
  boxSizing: "border-box" as const,
  display: "flex",
  flexDirection: "column" as const,
  gap: 18,
  justifyContent: "center",
  marginLeft: "calc(50% - 50vw)",
  marginRight: "calc(50% - 50vw)",
  overflow: "hidden",
  padding: "96px 16px",
  position: "relative" as const,
  textAlign: "center" as const,
  width: "auto",
};

const finalCtaGradientStyle = {
  background: "linear-gradient(135deg, var(--accent) 0%, var(--success) 100%)",
  inset: 0,
  opacity: 0.1,
  position: "absolute" as const,
};

const finalCtaInnerStyle = {
  alignItems: "center",
  display: "flex",
  flexDirection: "column" as const,
  gap: 18,
  margin: "0 auto",
  maxWidth: 768,
  position: "relative" as const,
  width: "100%",
};

const finalCtaTitleStyle = {
  color: "var(--foreground)",
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: "-0.01em",
  lineHeight: 1.25,
  margin: 0,
};

const finalCtaSubtitleStyle = {
  color: "var(--muted)",
  fontSize: 15,
  lineHeight: 1.6,
  margin: 0,
  maxWidth: 560,
};

const ctaLinkBaseStyle: CSSProperties = {
  alignItems: "center",
  borderRadius: "var(--radius)",
  display: "inline-flex",
  fontSize: 15,
  fontWeight: 500,
  justifyContent: "center",
  minHeight: 48,
  padding: "0 24px",
  position: "relative",
  textDecoration: "none",
  transition: "background 0.15s, transform 0.15s",
};

const ctaContentStyle = {
  alignItems: "center",
  display: "inline-flex",
  gap: 8,
  justifyContent: "center",
};

const trustIndicatorsStyle = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 24,
  justifyContent: "center",
  marginTop: 18,
};

const trustIndicatorStyle = {
  alignItems: "center",
  color: "var(--muted)",
  display: "inline-flex",
  fontSize: 13,
  gap: 8,
};

const footerStyle = {
  background: "var(--surface)",
  borderTop: "1px solid var(--subtle-border)",
  boxSizing: "border-box" as const,
  marginLeft: "calc(50% - 50vw)",
  marginRight: "calc(50% - 50vw)",
  padding: "32px 16px",
  width: "auto",
};

const footerInnerStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 24,
  margin: "0 auto",
  maxWidth: 1120,
  width: "100%",
};

const footerLinksStyle = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "12px 28px",
  justifyContent: "center",
};

const footerLinkStyle = {
  color: "var(--muted)",
  fontSize: 14,
  textDecoration: "none",
  transition: "opacity 0.15s",
};

const footerBottomStyle = {
  alignItems: "center",
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
};

const footerTextStyle = {
  color: "var(--muted)",
  fontSize: 12,
  margin: 0,
  textAlign: "center" as const,
};

const footerDisclaimerStyle = {
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.5,
  margin: 0,
  maxWidth: 620,
  textAlign: "center" as const,
};
