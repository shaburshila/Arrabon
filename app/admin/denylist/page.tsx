"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";

import { useWalletSessionContext } from "@/contexts/wallet-session-context";
import { ApiError } from "@/lib/api/auth";
import {
  addAdminDenylistEntry,
  type AddAdminDenylistInput,
  type AdminDenylistEntry,
  type AdminDenylistReason,
  fetchAdminDenylist,
  removeAdminDenylistEntry,
} from "@/lib/api/admin";
import { AppShell } from "@/components/app/app-shell";
import { ActionPanel } from "@/components/shared/action-panel";
import { Btn } from "@/components/shared/btn";
import { DetailRow } from "@/components/shared/detail-row";
import { FormField } from "@/components/shared/form-field";
import { ListPagination } from "@/components/shared/list-pagination";
import { Notice } from "@/components/shared/notice";
import { TextArea } from "@/components/shared/text-area";
import { TextInput } from "@/components/shared/text-input";
import { canSubmitDenylistRemoval } from "./helpers";

const PAGE_SIZE = 20;

interface DenylistFormState {
  notes: string;
  reason: AdminDenylistReason;
  wallet: string;
}

interface RemoveState {
  comment: string;
  wallet: string | null;
}

const emptyForm: DenylistFormState = {
  notes: "",
  reason: "fraud",
  wallet: "",
};

const emptyRemoveState: RemoveState = {
  comment: "",
  wallet: null,
};

export default function AdminDenylistPage() {
  const session = useWalletSessionContext();
  const [entries, setEntries] = useState<AdminDenylistEntry[]>([]);
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<DenylistFormState>(emptyForm);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removeState, setRemoveState] = useState<RemoveState>(emptyRemoveState);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removingWallet, setRemovingWallet] = useState<string | null>(null);

  const canLoadAdmin =
    session.isConnected &&
    session.isCorrectChain &&
    session.siweStatus === "authenticated" &&
    session.session?.is_admin === true;

  const loadEntries = useCallback(async () => {
    if (!canLoadAdmin) {
      setEntries([]);
      setHasNextPage(false);
      setPage(0);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const loadedEntries = await fetchAdminDenylist({
        limit: PAGE_SIZE + 1,
        offset: page * PAGE_SIZE,
      });
      setHasNextPage(loadedEntries.length > PAGE_SIZE);
      setEntries(loadedEntries.slice(0, PAGE_SIZE));
    } catch (error) {
      setLoadError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to load denylist.",
      );
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [canLoadAdmin, page]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  function setField(field: keyof DenylistFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canLoadAdmin || submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const input: AddAdminDenylistInput = {
        notes: form.notes.trim() ? form.notes.trim() : null,
        reason: form.reason,
        wallet: form.wallet.trim(),
      };

      const result = await addAdminDenylistEntry(input);
      setSubmitSuccess(`Added ${result.wallet} to the denylist.`);
      setForm(emptyForm);
      await loadEntries();
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to add denylist entry.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmRemove(wallet: string) {
    if (!canSubmitDenylistRemoval(removeState.comment) || removingWallet) {
      setRemoveError("Removal comment is required.");
      return;
    }

    setRemoveError(null);
    setRemovingWallet(wallet);
    setSubmitSuccess(null);

    try {
      await removeAdminDenylistEntry(wallet, {
        comment: removeState.comment.trim(),
      });
      setRemoveState(emptyRemoveState);
      await loadEntries();
    } catch (error) {
      setRemoveError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to remove denylist entry.",
      );
    } finally {
      setRemovingWallet(null);
    }
  }

  return (
    <AppShell maxWidth={1180}>
      <nav className="admin-subnav">
        <span className="admin-badge">Admin</span>
        <Link href="/admin/disputes" style={adminNavLinkStyle}>Disputes</Link>
        <Link href="/admin/denylist" style={adminNavLinkStyle}>Denylist</Link>
      </nav>

      <div style={headerStyle}>
        <h1 className="h1">Compliance denylist</h1>
        <p className="lede" style={{ marginTop: 8 }}>
          Add or remove blocked wallets and keep an auditable compliance trail.
        </p>
      </div>

      {session.siweStatus === "authenticated" && session.session?.is_admin !== true && (
        <Notice message="This wallet does not have admin permissions." tone="danger" />
      )}

      {canLoadAdmin && (
        <div style={pageStackStyle}>
          <ActionPanel as="section" style={sectionStyle}>
            <form onSubmit={handleSubmit} style={formStyle}>
              <div style={sectionHeaderStyle}>
                <h2 className="h2">Add denylist entry</h2>
                <p className="lede" style={{ marginTop: 6 }}>
                  Use this for fraud, abuse, sanctions escalation, or manual legal decisions.
                </p>
              </div>

              <FormField label="Wallet">
                <TextInput
                  onChange={(event) => setField("wallet", event.target.value)}
                  placeholder="0x..."
                  required
                  value={form.wallet}
                />
              </FormField>

              <FormField label="Reason">
                <select
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    setField("reason", event.target.value)
                  }
                  style={selectStyle}
                  value={form.reason}
                >
                  <option value="fraud">Fraud</option>
                  <option value="abuse">Abuse</option>
                  <option value="sanctions">Sanctions</option>
                  <option value="other">Other</option>
                </select>
              </FormField>

              <FormField helper="Optional internal note for the audit trail." label="Notes">
                <TextArea
                  onChange={(event) => setField("notes", event.target.value)}
                  rows={4}
                  value={form.notes}
                />
              </FormField>

              {submitError && (
                <Notice message={submitError} tone="danger" />
              )}

              {submitSuccess && (
                <Notice message={submitSuccess} tone="success" />
              )}

              <Btn fullWidth loading={submitting} type="submit">
                Add to denylist
              </Btn>
            </form>
          </ActionPanel>

          <ActionPanel as="section" style={sectionStyle}>
            <div style={toolbarStyle}>
              <div>
                <h2 className="h2">Current entries</h2>
                <p className="lede" style={{ marginTop: 6 }}>Page {page + 1} · {entries.length} shown</p>
              </div>
              <button
                disabled={loading}
                onClick={loadEntries}
                style={smallButtonStyle}
                type="button"
              >
                Refresh
              </button>
            </div>

            {loading && <Notice message="Loading denylist..." tone="muted" />}
            {loadError && <Notice message={loadError} tone="danger" />}
            {!loading && !loadError && entries.length === 0 && (
              <Notice message="No denylist entries yet." tone="muted" />
            )}

            {!loading && !loadError && entries.length > 0 && (
              <div style={listStyle}>
                {entries.map((entry) => {
                  const expanded = removeState.wallet === entry.wallet;
                  const isRemoving = removingWallet === entry.wallet;

                  return (
                    <div key={entry.wallet} style={entryCardStyle}>
                      <div style={entryHeaderStyle}>
                        <div style={entryMetaStyle}>
                          <DetailRow label="Wallet" value={entry.wallet} />
                          <DetailRow label="Reason" value={entry.reason} />
                          <DetailRow label="Added by" value={entry.added_by_wallet} />
                          <DetailRow
                            bordered={false}
                            label="Added at"
                            value={entry.added_at}
                          />
                        </div>

                        {!expanded ? (
                          <Btn
                            onClick={() => {
                              setRemoveError(null);
                              setRemoveState({ comment: "", wallet: entry.wallet });
                            }}
                            variant="danger"
                          >
                            Remove
                          </Btn>
                        ) : (
                          <div style={inlineRemoveStyle}>
                            <FormField label="Removal comment">
                              <TextArea
                                onChange={(event) =>
                                  setRemoveState((prev) => ({
                                    ...prev,
                                    comment: event.target.value,
                                  }))
                                }
                                rows={3}
                                value={removeState.comment}
                              />
                            </FormField>

                            {removeError && (
                              <Notice message={removeError} tone="danger" />
                            )}

                            <div style={removeActionsStyle}>
                              <Btn
                                disabled={!canSubmitDenylistRemoval(removeState.comment)}
                                loading={isRemoving}
                                onClick={() => confirmRemove(entry.wallet)}
                                variant="danger"
                              >
                                Confirm remove
                              </Btn>
                              <Btn
                                disabled={isRemoving}
                                onClick={() => {
                                  setRemoveError(null);
                                  setRemoveState(emptyRemoveState);
                                }}
                                variant="ghost"
                              >
                                Cancel
                              </Btn>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && !loadError && (page > 0 || hasNextPage) && (
              <ListPagination
                currentPage={page}
                hasNextPage={hasNextPage}
                onNext={() => setPage((value) => value + 1)}
                onPrevious={() => setPage((value) => Math.max(0, value - 1))}
              />
            )}
          </ActionPanel>
        </div>
      )}
    </AppShell>
  );
}

const pageStackStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
} as const;

const headerStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
} as const;

const adminNavLinkStyle = {
  color: "var(--muted)",
  fontSize: 14,
  fontWeight: 500,
  textDecoration: "none",
} as const;

const sectionStyle = {
  padding: 20,
} as const;

const sectionHeaderStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
} as const;

const formStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 14,
} as const;

const toolbarStyle = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
  marginBottom: 12,
} as const;

const smallButtonStyle = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 13,
  fontWeight: 700,
  minHeight: 36,
  padding: "0 12px",
} as const;

const listStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
} as const;

const entryCardStyle = {
  background: "var(--panel-muted)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 12,
} as const;

const entryHeaderStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
} as const;

const entryMetaStyle = {
  display: "flex",
  flexDirection: "column" as const,
} as const;

const inlineRemoveStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
} as const;

const removeActionsStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
} as const;

const selectStyle = {
  background: "var(--input-bg)",
  border: "1px solid var(--input-border)",
  borderRadius: "var(--radius)",
  color: "var(--foreground)",
  fontSize: 16,
  fontWeight: 400,
  minHeight: 48,
  outline: "none",
  padding: "0 14px",
  width: "100%",
};
