import { baseRuntimeConfig } from "@/lib/base/config";

export default function HomePage() {
  const ctaPlaceholder = "Wallet connect, link creation, and deal flows land in Sprint 1.";

  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        padding: "32px 16px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 720,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          padding: 24,
          borderRadius: 20,
          boxShadow: "0 16px 48px rgba(31, 41, 55, 0.08)",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "var(--accent)",
            fontSize: 14,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Base Consult Link
        </p>
        <h1 style={{ marginBottom: 12 }}>Sprint 0 skeleton</h1>
        <p style={{ marginTop: 0, color: "var(--muted)" }}>
          App shell is running and ready for Sprint 1 integration work.
        </p>

        <div
          style={{
            display: "grid",
            gap: 12,
            marginTop: 24,
            padding: 16,
            border: "1px solid var(--border)",
            borderRadius: 16,
          }}
        >
          <div>
            <strong>Status:</strong> Running
          </div>
          <div>
            <strong>Chain:</strong> {baseRuntimeConfig.chain.name} ({baseRuntimeConfig.chain.id})
          </div>
          <div>
            <strong>RPC configured:</strong> {baseRuntimeConfig.rpcUrl ? "Yes" : "No"}
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 16,
            background: "rgba(15, 118, 110, 0.08)",
          }}
        >
          <strong>Future CTA area</strong>
          <p style={{ marginBottom: 0 }}>{ctaPlaceholder}</p>
        </div>
      </section>
    </main>
  );
}
