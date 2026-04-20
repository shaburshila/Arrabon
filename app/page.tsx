"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Check,
  ChevronRight,
  Link2,
  Lock,
  MessageSquare,
  Plus,
  Shield,
  User,
  Wallet,
  Zap,
} from "lucide-react";

import { useWalletSession } from "@/hooks/use-wallet-session";
import { AppShell } from "@/components/app/app-shell";
import { Btn } from "@/components/shared/btn";
import { ActionPanel } from "@/components/shared/action-panel";
import { StatusPill } from "@/components/shared/status-pill";

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

const disputeCards = [
  {
    description: "A buyer can open a dispute when the consultation outcome needs review.",
    icon: AlertTriangle,
    iconBg: "var(--warning-muted)",
    iconColor: "var(--warning)",
    title: "Buyer opens dispute",
  },
  {
    description: "Both sides can add messages and evidence URLs for review.",
    icon: MessageSquare,
    iconBg: "var(--accent-soft)",
    iconColor: "var(--accent)",
    title: "Evidence stays visible",
  },
  {
    description: "A neutral admin reviews the deal context before preparing a decision.",
    icon: Shield,
    iconBg: "var(--accent-muted)",
    iconColor: "var(--accent)",
    title: "Admin reviews context",
  },
  {
    description: "The final release or refund is signed by an admin wallet.",
    icon: Check,
    iconBg: "rgba(34, 197, 94, 0.1)",
    iconColor: "var(--success)",
    title: "Wallet-signed resolution",
  },
] as const;

const securityCards = [
  {
    description: "Payment is routed through the escrow contract instead of a direct upfront transfer.",
    icon: Lock,
    iconBg: "var(--accent-soft)",
    iconColor: "var(--accent)",
    title: "USDC escrow on Base",
  },
  {
    description: "Funding, release, refund, and admin resolution require wallet signatures.",
    icon: Wallet,
    iconBg: "rgba(34, 197, 94, 0.1)",
    iconColor: "var(--success)",
    title: "Wallet-signed actions",
  },
  {
    description: "Escrow behavior is covered by automated tests before launch.",
    icon: Check,
    iconBg: "var(--accent-muted)",
    iconColor: "var(--accent)",
    title: "Contract-tested flow",
  },
  {
    description: "Admin resolution is prepared by the backend, but signed by an admin wallet.",
    icon: Shield,
    iconBg: "var(--warning-muted)",
    iconColor: "var(--warning)",
    title: "No backend admin key",
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

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function HomePage() {
  const session = useWalletSession();
  const isAdmin = session.session?.is_admin === true;

  return (
    <AppShell maxWidth={1120}>
      <div style={homeStackStyle}>
        <HeroSection isAdmin={isAdmin} session={session} />
        <HowItWorksSection />
        <BenefitsSection />
        <DisputeReviewSection />
        <SecuritySection />
        <FinalCtaSection />
        <HomeFooter />
      </div>
    </AppShell>
  );
}

function HeroSection({
  isAdmin,
  session,
}: {
  isAdmin: boolean;
  session: ReturnType<typeof useWalletSession>;
}) {
  return (
    <section style={heroStyle}>
      <div style={heroCopyStyle}>
        <div style={badgeStyle}>
          <SparkleIcon />
          <span>Secured by Base</span>
        </div>

        <h1 style={heroTitleStyle}>
          Get paid when the consultation is{" "}
          <span style={heroTitleAccentStyle}>confirmed.</span>
        </h1>

        <p style={heroSubtitleStyle}>
          Create a secure payment link. Share it with a buyer. Funds are held in USDC escrow on Base until the consultation is confirmed or resolved.
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
          <span>Funds held in escrow · Wallet-signed actions · Base L2</span>
        </div>
      </div>

      <LaunchpadPanel isAdmin={isAdmin} session={session} />
    </section>
  );
}

function LaunchpadPanel({
  isAdmin,
  session,
}: {
  isAdmin: boolean;
  session: ReturnType<typeof useWalletSession>;
}) {
  const walletLabel = session.address ? shortAddress(session.address) : "Connected wallet";

  return (
    <ActionPanel style={launchpadPanelStyle}>
      <div style={launchpadHeaderStyle}>
        <div style={brandIconStyle}>
          <Zap size={18} fill="currentColor" />
        </div>
        <div>
          <p style={launchpadTitleStyle}>Base Consult Link</p>
          <p style={launchpadSubtitleStyle}>Escrow-backed consultation protocol</p>
        </div>
      </div>

      <nav aria-label="Home actions" style={launchpadRowsStyle}>
        <LaunchpadRow
          href="/create"
          icon={<Plus size={18} />}
          iconStyle="accent"
          subtitle="New paid consultation"
          title="Create link"
        />
        <LaunchpadRow
          href="/my-links"
          icon={<Link2 size={18} />}
          iconStyle="success"
          subtitle="Manage seller links"
          title="My links"
        />
        <LaunchpadRow
          href="/my-deals"
          icon={<Briefcase size={18} />}
          iconStyle="warning"
          subtitle="Paid consultations"
          title="My deals"
        />
        {isAdmin && (
          <LaunchpadRow
            href="/admin/disputes"
            icon={<Shield size={18} />}
            iconStyle="admin"
            subtitle="Resolve open disputes"
            title="Admin disputes"
          />
        )}
      </nav>

      <div style={walletAreaStyle}>
        {session.isConnected ? (
          <div style={walletConnectedStyle}>
            <div style={walletIdentityStyle}>
              <span style={walletAvatarStyle} />
              <span style={walletAddressStyle}>{walletLabel}</span>
            </div>
            <StatusPill
              label={isAdmin ? "Admin · Base" : "Connected · Base"}
              tone={isAdmin ? "warning" : "success"}
            />
          </div>
        ) : (
          <Btn fullWidth onClick={() => session.connect()}>
            Connect wallet to get started
            <ArrowRight size={14} />
          </Btn>
        )}
      </div>
    </ActionPanel>
  );
}

function LaunchpadRow({
  href,
  icon,
  iconStyle,
  subtitle,
  title,
}: {
  href: string;
  icon: ReactNode;
  iconStyle: "accent" | "admin" | "success" | "warning";
  subtitle: string;
  title: string;
}) {
  const [hovered, setHovered] = useState(false);
  const colors = launchpadIconStyles[iconStyle];

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...launchpadRowStyle,
        background: hovered ? "var(--panel-hover)" : "transparent",
      }}
    >
      <span
        style={{
          ...launchpadRowIconStyle,
          background: colors.bg,
          color: colors.color,
        }}
      >
        {icon}
      </span>
      <span style={launchpadRowTextStyle}>
        <span style={launchpadRowTitleStyle}>{title}</span>
        <span style={launchpadRowSubtitleStyle}>{subtitle}</span>
      </span>
      <ChevronRight
        size={16}
        style={{
          color: hovered ? "var(--muted)" : "var(--border)",
          flexShrink: 0,
        }}
      />
    </Link>
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
    <section style={sectionStyle}>
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
    </section>
  );
}

function DisputeReviewSection() {
  return (
    <section style={sectionStyle}>
      <SectionHeader
        eyebrow="Dispute review"
        title="Disputes stay reviewable"
        subtitle="Both sides can add context before an admin wallet signs the final release or refund."
      />
      <div style={fourCardGridStyle}>
        {disputeCards.map((card) => (
          <InfoCard
            compact
            description={card.description}
            icon={<card.icon size={20} />}
            iconBg={card.iconBg}
            iconColor={card.iconColor}
            key={card.title}
            title={card.title}
          />
        ))}
      </div>
      <p style={sectionNoteStyle}>
        Admin private keys are not stored on the backend.
      </p>
    </section>
  );
}

function SecuritySection() {
  return (
    <section style={sectionStyle}>
      <SectionHeader
        eyebrow="Security model"
        title="Wallet-first escrow controls"
      />
      <div style={fourCardGridStyle}>
        {securityCards.map((card) => (
          <InfoCard
            compact
            description={card.description}
            icon={<card.icon size={20} />}
            iconBg={card.iconBg}
            iconColor={card.iconColor}
            key={card.title}
            title={card.title}
          />
        ))}
      </div>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section style={finalCtaStyle}>
      <h2 style={finalCtaTitleStyle}>Ready to create your first consultation link?</h2>
      <p style={finalCtaSubtitleStyle}>
        Set the terms, share the link, and let the buyer fund escrow on Base.
      </p>
      <CtaLink href="/create" variant="primary">
        Create your first link
        <ArrowRight size={16} />
      </CtaLink>
      <div style={trustIndicatorsStyle}>
        <TrustIndicator label="Built on Base" />
        <TrustIndicator label="Wallet-signed actions" />
        <TrustIndicator label="Neutral dispute review" />
      </div>
    </section>
  );
}

function HomeFooter() {
  return (
    <footer style={footerStyle}>
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
        transform: hovered && isPrimary ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      <span style={ctaContentStyle}>
        {typeof children === "string" ? children : renderCtaChildren(children, hovered)}
      </span>
    </Link>
  );
}

function renderCtaChildren(children: ReactNode, hovered: boolean) {
  return Children.map(children, (child) => {
    if (!isValidElement<{ style?: CSSProperties }>(child)) {
      return child;
    }

    if (child.type !== ArrowRight) {
      return child;
    }

    return cloneElement(child, {
      style: {
        ...child.props.style,
        transform: hovered ? "translateX(4px)" : "translateX(0)",
        transition: "transform 0.15s",
      },
    });
  });
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

const heroStyle = {
  alignItems: "center",
  display: "grid",
  gap: 32,
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
  padding: "56px 0 72px",
};

const heroCopyStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 20,
  maxWidth: 520,
};

const badgeStyle = {
  alignItems: "center",
  alignSelf: "flex-start",
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
  fontSize: "clamp(34px, 7vw, 58px)",
  fontWeight: 800,
  letterSpacing: "-0.02em",
  lineHeight: 1.08,
  margin: 0,
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
  maxWidth: 470,
};

const heroActionsStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 12,
};

const trustLineStyle = {
  alignItems: "center",
  color: "var(--muted)",
  display: "flex",
  flexWrap: "wrap" as const,
  fontSize: 12,
  gap: 8,
};

const launchpadPanelStyle = {
  alignSelf: "center",
  justifySelf: "center",
  maxWidth: 448,
  overflow: "hidden",
  width: "100%",
};

const launchpadHeaderStyle = {
  alignItems: "center",
  borderBottom: "1px solid var(--subtle-border)",
  display: "flex",
  gap: 12,
  padding: 20,
};

const brandIconStyle = {
  alignItems: "center",
  background: "var(--accent)",
  borderRadius: "var(--radius)",
  color: "#fff",
  display: "inline-flex",
  flexShrink: 0,
  height: 40,
  justifyContent: "center",
  width: 40,
};

const launchpadTitleStyle = {
  color: "var(--foreground)",
  fontSize: 16,
  fontWeight: 600,
  margin: 0,
};

const launchpadSubtitleStyle = {
  color: "var(--muted)",
  fontSize: 12,
  margin: "2px 0 0",
};

const launchpadRowsStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 4,
  padding: 12,
};

const launchpadRowStyle = {
  alignItems: "center",
  borderRadius: "var(--radius)",
  color: "var(--foreground)",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
  padding: 16,
  textDecoration: "none",
  transition: "background 0.15s",
};

const launchpadRowIconStyle = {
  alignItems: "center",
  borderRadius: "var(--radius)",
  display: "inline-flex",
  flexShrink: 0,
  height: 40,
  justifyContent: "center",
  width: 40,
};

const launchpadIconStyles = {
  accent: {
    bg: "var(--accent-soft)",
    color: "var(--accent)",
  },
  admin: {
    bg: "var(--warning-muted)",
    color: "var(--warning)",
  },
  success: {
    bg: "rgba(34, 197, 94, 0.1)",
    color: "var(--success)",
  },
  warning: {
    bg: "var(--warning-muted)",
    color: "var(--warning)",
  },
} as const;

const launchpadRowTextStyle = {
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column" as const,
  minWidth: 0,
};

const launchpadRowTitleStyle = {
  color: "var(--foreground)",
  fontSize: 15,
  fontWeight: 500,
};

const launchpadRowSubtitleStyle = {
  color: "var(--muted)",
  fontSize: 12,
  marginTop: 2,
};

const walletAreaStyle = {
  borderTop: "1px solid var(--subtle-border)",
  padding: 16,
};

const walletConnectedStyle = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 12,
  justifyContent: "space-between",
};

const walletIdentityStyle = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  minWidth: 0,
};

const walletAvatarStyle = {
  background: "linear-gradient(135deg, var(--accent) 0%, var(--success) 100%)",
  borderRadius: "50%",
  display: "inline-block",
  flexShrink: 0,
  height: 24,
  width: 24,
};

const walletAddressStyle = {
  color: "var(--muted)",
  fontSize: 14,
};

const sectionStyle = {
  padding: "72px 0",
};

const sectionHeaderStyle = {
  alignItems: "center",
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
  marginBottom: 40,
  textAlign: "center" as const,
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
};

const fourCardGridStyle = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
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

const sectionNoteStyle = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.5,
  margin: "20px 0 0",
  textAlign: "center" as const,
};

const finalCtaStyle = {
  alignItems: "center",
  background: "var(--accent-muted)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 18,
  margin: "56px 0",
  padding: "56px 24px",
  textAlign: "center" as const,
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
  minWidth: 160,
  padding: "0 24px",
  textDecoration: "none",
  transition: "background 0.15s, transform 0.15s",
};

const ctaContentStyle = {
  alignItems: "center",
  display: "inline-flex",
  gap: 8,
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
  borderTop: "1px solid var(--subtle-border)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 24,
  padding: "32px 0",
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
