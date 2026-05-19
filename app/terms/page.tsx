import { LegalPageLayout } from "@/components/shared/legal-page-layout";

type LegalSection =
  | { body: readonly string[]; items?: never; title: string }
  | { body?: never; items: readonly string[]; title: string };

const sections: readonly LegalSection[] = [
  {
    body: [
      "These Terms of Service explain the terms and conditions by which you may access and use Arrabon. The service enables users to create, fund, and manage single-use consultation payment links using USDC on the Base blockchain.",
      "By accessing or using the service, you agree to be bound by these terms in full. If you do not agree, you are not authorized to access or use the service.",
      "You represent that you are at least 18 years old, or the age of majority in your jurisdiction if higher, and that you have the authority to enter into this agreement.",
      "You also represent that you are not a sanctioned person and are not using the service in violation of applicable laws or sanctions restrictions.",
    ],
    title: "Introduction and Eligibility",
  },
  {
    body: [
      "Arrabon is a web-based interface through which sellers may create single-use consultation links and buyers may fund escrow arrangements using USDC on Base.",
      "Each consultation link is intended for a single consultation transaction. Once funded or otherwise consumed in accordance with service rules, it may not be reused.",
      "Funds are processed through blockchain-based smart contracts and related off-chain workflows. If there is a conflict between on-chain state and off-chain records, on-chain state is authoritative except where a compliance hold or administrative action applies under these terms.",
    ],
    title: "The Service",
  },
  {
    items: [
      "fraud, misrepresentation, or misleading consultation details",
      "sanctions violations or use by prohibited persons",
      "unlawful transactions or facilitation of illegal conduct",
      "attempts to interfere with, attack, or compromise the service or smart contracts",
      "data scraping, automated extraction, or similar misuse",
    ],
    title: "Prohibited Activity",
  },
  {
    body: [
      "The service is a non-custodial software platform. Users are solely responsible for the custody of their wallets, private keys, seed phrases, and signing actions.",
      "You understand and accept the inherent risks of blockchain systems, including irreversible transactions, smart contract failures, infrastructure outages, network congestion, forks, and chain reorganizations.",
      "We do not control the Base blockchain, USDC, third-party wallet providers, or third-party infrastructure providers.",
    ],
    title: "Wallet Responsibility and Blockchain Risk",
  },
  {
    body: [
      "Arrabon is a technology platform and is not a party to the underlying consultation agreement between buyer and seller.",
      "We do not guarantee the quality, legality, safety, suitability, or outcome of any consultation, and we do not guarantee that a seller will perform or that a buyer will act in good faith.",
      "Users are solely responsible for the content, performance, and legality of their consultation arrangements.",
    ],
    title: "Consultation Relationship",
  },
  {
    body: [
      "The service may support seller completion, buyer confirmation, dispute initiation, administrative resolution, and automatic release after a defined response window expires.",
      "Service logic and smart contract rules determine when release, refund, dispute, or auto-release actions are available. Certain actions are time-limited, and failure to act in time may result in an automatic outcome.",
    ],
    title: "Disputes, Refunds, and Auto-Release",
  },
  {
    body: [
      "We may apply sanctions screening, denylist checks, fraud controls, blockchain-related risk assessments, and related compliance measures before or after funding, release, or payout actions.",
      "We may deny, delay, pause, restrict, block, or refuse access to the service or to specific actions where necessary to comply with law, protect the integrity of the service, or manage legal or financial risk.",
      "We are not required to disclose the specific basis of a compliance decision where disclosure would create legal or operational risk or undermine abuse-prevention controls.",
    ],
    title: "Compliance Screening and Restrictions",
  },
  {
    body: [
      "Arrabon does not hold, and does not represent that it holds, a banking license, money transmitter license, broker-dealer registration, investment adviser registration, or equivalent financial-services authorization in any jurisdiction.",
      "The service is a software platform that facilitates user interaction with blockchain-based smart contracts. It does not accept regulated deposits, provide financial advice, or act as a regulated custodian of user assets.",
    ],
    title: "Regulatory Disclaimer",
  },
  {
    body: [
      "The service is provided on an as-is and as-available basis to the fullest extent permitted by law.",
      "We disclaim warranties regarding continuous availability, error-free operation, security, and the accuracy or completeness of information in the service.",
      "Our total liability is limited to the greater of the platform fees you paid us for the specific transaction giving rise to the claim or USD $100, subject to applicable law.",
    ],
    title: "Disclaimers and Limitation of Liability",
  },
  {
    body: [
      "Your use of the service is subject to our Privacy Policy, which is incorporated by reference.",
      "These terms are governed by the laws of the British Virgin Islands, and disputes are subject to the arbitration and class-action waiver provisions described in the full legal text.",
      "For questions, notices, or requests regarding this agreement, contact shaburshil@gmail.com.",
    ],
    title: "Privacy, Governing Law, and Contact",
  },
];

export default function TermsPage() {
  return (
    <LegalPageLayout lastUpdated="May 6, 2026" title="Terms of Service">
      {sections.map((section) => (
        <section key={section.title} style={sectionStyle}>
          <h2 style={headingStyle}>{section.title}</h2>
          {section.body?.map((paragraph) => (
            <p key={paragraph} style={paragraphStyle}>
              {paragraph}
            </p>
          ))}
          {section.items && (
            <ul style={listStyle}>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </LegalPageLayout>
  );
}

const sectionStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
};

const headingStyle = {
  fontSize: 22,
  lineHeight: 1.2,
  margin: 0,
};

const paragraphStyle = {
  margin: 0,
};

const listStyle = {
  margin: "0 0 0 20px",
  padding: 0,
};
