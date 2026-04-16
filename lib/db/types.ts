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

export type DealResolutionType =
  | "admin_refund"
  | "admin_release"
  | "auto_release"
  | "buyer_confirmed";

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
  session_token_hash: string;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
}

export interface SessionInsert {
  id?: string;
  wallet: string;
  session_token_hash: string;
  expires_at: string;
  created_at?: string;
  revoked_at?: string | null;
}

export interface SessionUpdate {
  wallet?: string;
  session_token_hash?: string;
  expires_at?: string;
  created_at?: string;
  revoked_at?: string | null;
}

export interface ProcessedTransactionRow {
  tx_hash: string;
  event_type: string;
  deal_id: string | null;
  processed_at: string;
}

export interface ProcessedTransactionInsert {
  tx_hash: string;
  event_type: string;
  deal_id?: string | null;
  processed_at?: string;
}

export interface ProcessedTransactionUpdate {
  event_type?: string;
  deal_id?: string | null;
  processed_at?: string;
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
      audit_log: {
        Row: AuditLogRow;
        Insert: AuditLogInsert;
        Update: AuditLogUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
