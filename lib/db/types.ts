export type ConsultationLinkStatus =
  | "Draft"
  | "Open"
  | "Expired"
  | "Cancelled"
  | "Consumed";

export type DealStatus =
  | "Funded"
  | "ConfirmPending"
  | "Released"
  | "Refunded"
  | "Disputed";

export type DealRiskStatus = "Clear" | "Review" | "Blocked";

export type DealResolutionType =
  | "admin_refund"
  | "admin_release"
  | "auto_release"
  | "buyer_confirmed";
export type DealPayoutBlockRequestSource = "denylist_add";
export type DealPayoutBlockRequestStatus = "pending" | "applied" | "non_actionable";

export type ComplianceCheckSubjectType = "wallet" | "transaction";

export type ComplianceCheckResult = "Clear" | "Review" | "Blocked";

export type ComplianceReasonCode =
  | "NO_HIT"
  | "OFAC_SANCTIONS"
  | "USDC_BLACKLISTED"
  | "LOCAL_DENYLIST"
  | "PROVIDER_UNAVAILABLE"
  | "FRAUD_SIGNAL";

export type ComplianceProviderId =
  | "composite"
  | "chainalysis_sanctions_oracle"
  | "usdc_blacklist"
  | "local_denylist"
  | "ofac_sdn"
  | "chainabuse";

export type WalletDenylistReason = "fraud" | "abuse" | "sanctions" | "other";

export interface UserRow {
  id: string;
  wallet: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface UserInsert {
  id?: string;
  wallet: string;
  username?: string | null;
  avatar_url?: string | null;
  created_at?: string;
}

export interface UserUpdate {
  wallet?: string;
  username?: string | null;
  avatar_url?: string | null;
  created_at?: string;
}

export interface ConsultationLinkRow {
  id: string;
  creator_user_id: string;
  expert_address: string;
  title: string;
  description: string;
  price_usdc: string;
  scheduled_at: string;
  timezone: string;
  expires_at: string;
  duration_minutes: number;
  meeting_url_encrypted: string;
  link_hash: string;
  status: ConsultationLinkStatus;
  created_at: string;
}

export interface ConsultationLinkInsert {
  id?: string;
  creator_user_id: string;
  expert_address: string;
  title: string;
  description: string;
  price_usdc: string;
  scheduled_at: string;
  timezone: string;
  expires_at: string;
  duration_minutes: number;
  meeting_url_encrypted: string;
  link_hash: string;
  status: ConsultationLinkStatus;
  created_at?: string;
}

export interface ConsultationLinkUpdate {
  expert_address?: string;
  title?: string;
  description?: string;
  price_usdc?: string;
  scheduled_at?: string;
  timezone?: string;
  expires_at?: string;
  duration_minutes?: number;
  meeting_url_encrypted?: string;
  link_hash?: string;
  status?: ConsultationLinkStatus;
  created_at?: string;
}

export interface DealRow {
  id: string;
  consultation_link_id: string;
  onchain_deal_id: string;
  buyer_address: string;
  seller_address: string;
  status: DealStatus;
  risk_status: DealRiskStatus;
  funded_at: string | null;
  completed_at: string | null;
  released_at: string | null;
  resolution_type: DealResolutionType | null;
  resolved_at: string | null;
  resolved_by_wallet: string | null;
  resolved_from_status: DealStatus | null;
  tx_hash: string | null;
  created_at: string;
}

export interface DealInsert {
  id?: string;
  consultation_link_id: string;
  onchain_deal_id: string;
  buyer_address: string;
  seller_address: string;
  status: DealStatus;
  risk_status?: DealRiskStatus;
  funded_at?: string | null;
  completed_at?: string | null;
  released_at?: string | null;
  resolution_type?: DealResolutionType | null;
  resolved_at?: string | null;
  resolved_by_wallet?: string | null;
  resolved_from_status?: DealStatus | null;
  tx_hash?: string | null;
  created_at?: string;
}

export interface DealUpdate {
  consultation_link_id?: string;
  onchain_deal_id?: string;
  buyer_address?: string;
  seller_address?: string;
  status?: DealStatus;
  risk_status?: DealRiskStatus;
  funded_at?: string | null;
  completed_at?: string | null;
  released_at?: string | null;
  resolution_type?: DealResolutionType | null;
  resolved_at?: string | null;
  resolved_by_wallet?: string | null;
  resolved_from_status?: DealStatus | null;
  tx_hash?: string | null;
  created_at?: string;
}

export interface AuthNonceRow {
  id: string;
  wallet: string;
  nonce: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface AuthNonceInsert {
  id?: string;
  wallet: string;
  nonce: string;
  expires_at: string;
  used_at?: string | null;
  created_at?: string;
}

export interface AuthNonceUpdate {
  wallet?: string;
  nonce?: string;
  expires_at?: string;
  used_at?: string | null;
  created_at?: string;
}

export interface SessionRow {
  id: string;
  wallet: string;
  is_admin: boolean;
  session_token_hash: string;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
}

export interface SessionInsert {
  id?: string;
  wallet: string;
  is_admin: boolean;
  session_token_hash: string;
  expires_at: string;
  created_at?: string;
  revoked_at?: string | null;
}

export interface SessionUpdate {
  wallet?: string;
  is_admin?: boolean;
  session_token_hash?: string;
  expires_at?: string;
  created_at?: string;
  revoked_at?: string | null;
}

export interface ProcessedTransactionRow {
  tx_hash: string;
  event_type: string;
  deal_id: string | null;
  hold_applied: boolean | null;
  processed_at: string;
}

export interface ProcessedTransactionInsert {
  tx_hash: string;
  event_type: string;
  deal_id?: string | null;
  hold_applied?: boolean | null;
  processed_at?: string;
}

export interface ProcessedTransactionUpdate {
  event_type?: string;
  deal_id?: string | null;
  hold_applied?: boolean | null;
  processed_at?: string;
}

export interface DealPayoutBlockRequestRow {
  id: string;
  deal_id: string;
  onchain_deal_id: string;
  blocked: boolean;
  source: DealPayoutBlockRequestSource;
  status: DealPayoutBlockRequestStatus;
  applied_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  created_at: string;
}

export interface DealPayoutBlockRequestInsert {
  id?: string;
  deal_id: string;
  onchain_deal_id: string;
  blocked: boolean;
  source: DealPayoutBlockRequestSource;
  status?: DealPayoutBlockRequestStatus;
  applied_at?: string | null;
  last_error_code?: string | null;
  last_error_message?: string | null;
  created_at?: string;
}

export interface DealPayoutBlockRequestUpdate {
  deal_id?: string;
  onchain_deal_id?: string;
  blocked?: boolean;
  source?: DealPayoutBlockRequestSource;
  status?: DealPayoutBlockRequestStatus;
  applied_at?: string | null;
  last_error_code?: string | null;
  last_error_message?: string | null;
  created_at?: string;
}

export interface ComplianceCheckRow {
  id: string;
  subject_type: ComplianceCheckSubjectType;
  subject_value: string;
  provider: ComplianceProviderId;
  result: ComplianceCheckResult;
  reason_code: ComplianceReasonCode;
  raw_summary: Record<string, unknown>;
  checked_at: string;
  deal_id: string | null;
  actor_wallet: string | null;
}

export interface ComplianceCheckInsert {
  id?: string;
  subject_type: ComplianceCheckSubjectType;
  subject_value: string;
  provider: ComplianceProviderId;
  result: ComplianceCheckResult;
  reason_code: ComplianceReasonCode;
  raw_summary?: Record<string, unknown>;
  checked_at?: string;
  deal_id?: string | null;
  actor_wallet?: string | null;
}

export interface ComplianceCheckUpdate {
  subject_type?: ComplianceCheckSubjectType;
  subject_value?: string;
  provider?: ComplianceProviderId;
  result?: ComplianceCheckResult;
  reason_code?: ComplianceReasonCode;
  raw_summary?: Record<string, unknown>;
  checked_at?: string;
  deal_id?: string | null;
  actor_wallet?: string | null;
}

export interface WalletDenylistRow {
  wallet: string;
  reason: WalletDenylistReason;
  added_by_wallet: string;
  added_at: string;
  notes: string | null;
}

export interface WalletDenylistInsert {
  wallet: string;
  reason: WalletDenylistReason;
  added_by_wallet: string;
  added_at?: string;
  notes?: string | null;
}

export interface WalletDenylistUpdate {
  wallet?: string;
  reason?: WalletDenylistReason;
  added_by_wallet?: string;
  added_at?: string;
  notes?: string | null;
}

export type AdminResolutionIntentResolution = "refund" | "release";
export type PayoutExecutionGrantAction =
  | "adminResolveRefund"
  | "adminResolveRelease"
  | "confirmRelease";
export type PayoutExecutionGrantResolution = "refund" | "release";

export interface AdminResolutionIntentRow {
  id: string;
  deal_id: string;
  onchain_deal_id: string;
  resolution: AdminResolutionIntentResolution;
  admin_wallet: string;
  created_at: string;
  consumed_at: string | null;
}

export interface AdminResolutionIntentInsert {
  id?: string;
  deal_id: string;
  onchain_deal_id: string;
  resolution: AdminResolutionIntentResolution;
  admin_wallet: string;
  created_at?: string;
  consumed_at?: string | null;
}

export interface AdminResolutionIntentUpdate {
  deal_id?: string;
  onchain_deal_id?: string;
  resolution?: AdminResolutionIntentResolution;
  admin_wallet?: string;
  created_at?: string;
  consumed_at?: string | null;
}

export interface PayoutExecutionGrantRow {
  id: string;
  deal_id: string;
  action: PayoutExecutionGrantAction;
  resolution: PayoutExecutionGrantResolution | null;
  issued_to_wallet: string;
  issued_by_wallet: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface PayoutExecutionGrantInsert {
  id?: string;
  deal_id: string;
  action: PayoutExecutionGrantAction;
  resolution?: PayoutExecutionGrantResolution | null;
  issued_to_wallet: string;
  issued_by_wallet: string;
  token_hash: string;
  expires_at: string;
  used_at?: string | null;
  created_at?: string;
}

export interface PayoutExecutionGrantUpdate {
  deal_id?: string;
  action?: PayoutExecutionGrantAction;
  resolution?: PayoutExecutionGrantResolution | null;
  issued_to_wallet?: string;
  issued_by_wallet?: string;
  token_hash?: string;
  expires_at?: string;
  used_at?: string | null;
  created_at?: string;
}

export interface FundingExecutionGrantRow {
  id: string;
  consultation_link_id: string;
  issued_to_wallet: string;
  issued_by_wallet: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface FundingExecutionGrantInsert {
  id?: string;
  consultation_link_id: string;
  issued_to_wallet: string;
  issued_by_wallet: string;
  token_hash: string;
  expires_at: string;
  used_at?: string | null;
  created_at?: string;
}

export interface FundingExecutionGrantUpdate {
  consultation_link_id?: string;
  issued_to_wallet?: string;
  issued_by_wallet?: string;
  token_hash?: string;
  expires_at?: string;
  used_at?: string | null;
  created_at?: string;
}

export interface AuditLogRow {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogInsert {
  id?: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_address?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface AuditLogUpdate {
  entity_type?: string;
  entity_id?: string;
  action?: string;
  actor_address?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export type DisputeMessageAuthorRole = "admin" | "buyer" | "seller";

export interface DealDisputeMessageRow {
  id: string;
  deal_id: string;
  author_wallet: string;
  author_role: DisputeMessageAuthorRole;
  body: string;
  evidence_url: string | null;
  created_at: string;
}

export interface DealDisputeMessageInsert {
  id?: string;
  deal_id: string;
  author_wallet: string;
  author_role: DisputeMessageAuthorRole;
  body: string;
  evidence_url?: string | null;
  created_at?: string;
}

export interface DealDisputeMessageUpdate {
  deal_id?: string;
  author_wallet?: string;
  author_role?: DisputeMessageAuthorRole;
  body?: string;
  evidence_url?: string | null;
  created_at?: string;
}

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: UserInsert;
        Update: UserUpdate;
        Relationships: [];
      };
      consultation_links: {
        Row: ConsultationLinkRow;
        Insert: ConsultationLinkInsert;
        Update: ConsultationLinkUpdate;
        Relationships: [
          {
            foreignKeyName: "consultation_links_creator_user_id_fkey";
            columns: ["creator_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      deals: {
        Row: DealRow;
        Insert: DealInsert;
        Update: DealUpdate;
        Relationships: [
          {
            foreignKeyName: "deals_consultation_link_id_fkey";
            columns: ["consultation_link_id"];
            isOneToOne: true;
            referencedRelation: "consultation_links";
            referencedColumns: ["id"];
          },
        ];
      };
      auth_nonces: {
        Row: AuthNonceRow;
        Insert: AuthNonceInsert;
        Update: AuthNonceUpdate;
        Relationships: [];
      };
      sessions: {
        Row: SessionRow;
        Insert: SessionInsert;
        Update: SessionUpdate;
        Relationships: [];
      };
      processed_transactions: {
        Row: ProcessedTransactionRow;
        Insert: ProcessedTransactionInsert;
        Update: ProcessedTransactionUpdate;
        Relationships: [
          {
            foreignKeyName: "processed_transactions_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
        ];
      };
      deal_payout_block_requests: {
        Row: DealPayoutBlockRequestRow;
        Insert: DealPayoutBlockRequestInsert;
        Update: DealPayoutBlockRequestUpdate;
        Relationships: [
          {
            foreignKeyName: "deal_payout_block_requests_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
        ];
      };
      compliance_checks: {
        Row: ComplianceCheckRow;
        Insert: ComplianceCheckInsert;
        Update: ComplianceCheckUpdate;
        Relationships: [
          {
            foreignKeyName: "compliance_checks_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
        ];
      };
      wallet_denylist: {
        Row: WalletDenylistRow;
        Insert: WalletDenylistInsert;
        Update: WalletDenylistUpdate;
        Relationships: [];
      };
      admin_resolution_intents: {
        Row: AdminResolutionIntentRow;
        Insert: AdminResolutionIntentInsert;
        Update: AdminResolutionIntentUpdate;
        Relationships: [
          {
            foreignKeyName: "admin_resolution_intents_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
        ];
      };
      payout_execution_grants: {
        Row: PayoutExecutionGrantRow;
        Insert: PayoutExecutionGrantInsert;
        Update: PayoutExecutionGrantUpdate;
        Relationships: [
          {
            foreignKeyName: "payout_execution_grants_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
        ];
      };
      funding_execution_grants: {
        Row: FundingExecutionGrantRow;
        Insert: FundingExecutionGrantInsert;
        Update: FundingExecutionGrantUpdate;
        Relationships: [
          {
            foreignKeyName: "funding_execution_grants_consultation_link_id_fkey";
            columns: ["consultation_link_id"];
            referencedRelation: "consultation_links";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: AuditLogRow;
        Insert: AuditLogInsert;
        Update: AuditLogUpdate;
        Relationships: [];
      };
      deal_dispute_messages: {
        Row: DealDisputeMessageRow;
        Insert: DealDisputeMessageInsert;
        Update: DealDisputeMessageUpdate;
        Relationships: [
          {
            foreignKeyName: "deal_dispute_messages_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      consume_latest_admin_resolution_intent: {
        Args: {
          p_onchain_deal_id: string;
          p_resolution: AdminResolutionIntentResolution;
        };
        Returns: AdminResolutionIntentRow[];
      };
      insert_confirmed_deal_and_maybe_consume_link: {
        Args: {
          p_buyer_address: string;
          p_consultation_link_id: string;
          p_consume_link: boolean;
          p_funded_at: string | null;
          p_onchain_deal_id: string;
          p_seller_address: string;
          p_status: DealStatus;
          p_tx_hash: string | null;
        };
        Returns: DealRow[];
      };
      process_confirmed_funded_event_once: {
        Args: {
          p_buyer_address: string;
          p_consultation_link_id: string;
          p_consume_link: boolean;
          p_event_type: string;
          p_funded_at: string | null;
          p_onchain_deal_id: string;
          p_seller_address: string;
          p_status: DealStatus;
          p_tx_hash: string;
        };
        Returns: {
          already_processed: boolean;
          deal_id: string | null;
          hold_applied: boolean | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
