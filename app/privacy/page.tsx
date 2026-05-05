import { LegalPageLayout } from "@/components/shared/legal-page-layout";

type LegalSection =
  | { body: readonly string[]; items?: never; title: string }
  | { body?: never; items: readonly string[]; title: string };

const sections: readonly LegalSection[] = [
  {
    body: [
      "This Privacy Policy explains how Base Consult Link collects, uses, and shares data in connection with the service. Your use of the service is subject to this policy as well as the Terms of Service.",
    ],
    title: "Introduction",
  },
  {
    items: [
      "wallet addresses, transaction hashes, and related blockchain activity",
      "SIWE authentication data, nonce records, and session metadata",
      "consultation details such as title, price, schedule, expiry, timezone, and duration",
      "encrypted meeting URL records and dispute-related data",
      "compliance screening results, denylist records, and audit trail information",
      "server-side technical logs such as IP addresses, device, browser, and request metadata",
    ],
    title: "Data We Collect",
  },
  {
    items: [
      "to provide, operate, and secure the service",
      "to authenticate users and maintain sessions",
      "to process consultation funding, release, dispute, refund, and related lifecycle flows",
      "to conduct sanctions screening, denylist checks, and fraud prevention",
      "to maintain audit records and comply with legal obligations",
      "to improve the service using aggregated or anonymized insights",
    ],
    title: "How We Use Data",
  },
  {
    body: [
      "We may process wallet addresses and related transaction information for sanctions screening, denylist checks, risk review, blocked transaction handling, and related audit logging.",
      "Compliance screening may be performed before or after funding and may result in refusal, delay, restriction, review, or blocking of certain actions.",
      "Screening may involve third-party compliance providers that process wallet address data on our behalf.",
    ],
    title: "Compliance Screening",
  },
  {
    body: [
      "The service uses strictly necessary session cookies and related server-side controls to authenticate users, maintain secure sessions, and protect access to authenticated features.",
      "We do not use advertising cookies or behavioral tracking cookies. Disabling strictly necessary cookies will prevent access to authenticated features.",
    ],
    title: "Cookies and Session Technologies",
  },
  {
    items: [
      "service providers and vendors assisting us in operating the service",
      "blockchain infrastructure, RPC providers, hosting, database, and compliance providers",
      "regulators, law enforcement, or courts where disclosure is legally required",
      "professional advisers or counterparties in a merger, acquisition, restructuring, or similar transaction",
    ],
    title: "How We Share Data",
  },
  {
    body: [
      "We retain information for as long as reasonably necessary to provide the service, maintain transaction and audit records, support disputes, detect fraud or abuse, and satisfy legal, regulatory, tax, accounting, security, or compliance obligations.",
      "Blockchain records are public and effectively permanent. We cannot edit or delete on-chain records.",
    ],
    title: "Retention and Blockchain Permanence",
  },
  {
    body: [
      "We implement reasonable administrative, technical, and organizational safeguards to help protect data under our control.",
      "No method of transmission, storage, or processing is completely secure, and we cannot guarantee absolute security. Users remain responsible for protecting their wallets, private keys, seed phrases, and credentials.",
    ],
    title: "Security",
  },
  {
    body: [
      "Depending on your location and applicable law, you may have rights to request access, correction, deletion, restriction, objection, portability, or other privacy-related relief.",
      "Those rights may be limited where data must be retained for security, legal, compliance, audit, fraud-prevention, dispute-resolution, or transaction-record purposes.",
    ],
    title: "Your Rights",
  },
  {
    body: [
      "If you have any questions about this policy, how we collect or use data, or if you want to submit a privacy request, contact shaburshil@gmail.com.",
    ],
    title: "Contact",
  },
];

export default function PrivacyPage() {
  return (
    <LegalPageLayout lastUpdated="May 6, 2026" title="Privacy Policy">
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
