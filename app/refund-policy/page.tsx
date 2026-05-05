import { LegalPageLayout } from "@/components/shared/legal-page-layout";

type LegalSection =
  | { body: readonly string[]; items?: never; title: string }
  | { body?: never; items: readonly string[]; title: string };

const sections: readonly LegalSection[] = [
  {
    body: [
      "This Refund Policy explains when and how refunds may be issued for transactions processed through Base Consult Link. This policy is incorporated into our Terms of Service.",
      "Base Consult Link is a blockchain-based escrow platform. When a buyer funds a consultation link, USDC is transferred into a smart contract and held in escrow until funds are released to the seller, returned to the buyer, or placed under review.",
      "All confirmed on-chain outcomes are final and irreversible. Once funds have been released to the seller, no refund is possible.",
    ],
    title: "Overview",
  },
  {
    items: [
      "If a seller does not appear or fails to deliver the consultation and the buyer wins an administrative dispute review, funds may be returned to the buyer.",
      "If a consultation is disputed on quality grounds within the permitted dispute window, an administrator may decide to return funds to the buyer or release them to the seller based on the available evidence.",
    ],
    title: "When a Refund May Be Available",
  },
  {
    items: [
      "No refund is available once funds have been released to the seller through buyer confirmation, auto-release, or an administrative decision in the seller's favor.",
      "No refund is available if the buyer does not open a dispute within the allowed time window.",
      "Platform fees applied within the escrow flow are non-refundable.",
    ],
    title: "When a Refund Is Not Available",
  },
  {
    body: [
      "We conduct compliance and sanctions screening on wallet addresses involved in transactions. In some circumstances, a transaction may be placed under review or restricted as a result of this screening.",
      "If a transaction is placed under a compliance hold, funds cannot be released or refunded until the hold is resolved. In sanctions-related cases, we may be legally prohibited from returning funds without government authorization.",
      "We may not be able to disclose the specific basis for a compliance decision.",
    ],
    title: "Compliance-Related Holds and Restrictions",
  },
  {
    body: [
      "Refunds can only be requested through the dispute process available within the service on the deal page. We do not accept refund requests by email or other channels outside the platform.",
      "To request a refund, navigate to your deal page, use the dispute option available within the permitted time window, and submit your dispute message together with any supporting information.",
    ],
    title: "How to Request a Refund",
  },
  {
    body: [
      "For questions about this policy or the status of a refund, contact shaburshil@gmail.com.",
    ],
    title: "Contact",
  },
];

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout lastUpdated="May 6, 2026" title="Refund Policy">
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
