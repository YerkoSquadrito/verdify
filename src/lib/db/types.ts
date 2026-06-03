// Hand-written row types mirroring supabase/migrations. Kept in sync by hand
// for the prototype (swap for `supabase gen types` once the DB is hosted).

export type OrgType = "owner" | "property_mgmt" | "consultant";
export type MemberRole =
  | "building_owner"
  | "property_manager"
  | "energy_consultant";
export type Ownership = "private" | "city";
export type DataSource = "socrata" | "manual";
export type ComplianceEventType =
  | "benchmark_submitted"
  | "arcx_completed"
  | "violation_issued"
  | "fine_paid";
export type DocumentType =
  | "benchmark_submission"
  | "arcx_report"
  | "lender_packet"
  | "other";
export type DeadlineKind = "benchmark" | "arcx";
export type AlertChannel = "email" | "sms" | "in_app";
export type AlertStatus = "pending" | "sent" | "dismissed";

export interface Organization {
  id: string;
  name: string;
  type: OrgType;
  subdomain: string | null;
  created_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  org_id: string;
  role: MemberRole;
  created_at: string;
}

export interface Building {
  id: string;
  org_id: string;
  bin: string;
  name: string | null;
  address: string | null;
  sqft: number;
  ownership: Ownership;
  data_source: DataSource;
  source_raw: unknown | null;
  created_at: string;
}

export interface ComplianceEvent {
  id: string;
  org_id: string;
  building_id: string;
  event_type: ComplianceEventType;
  event_date: string;
  metadata: unknown | null;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  org_id: string;
  building_id: string;
  doc_type: DocumentType;
  storage_path: string;
  filename: string;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface AlertRow {
  id: string;
  org_id: string;
  building_id: string;
  deadline_type: DeadlineKind;
  deadline_date: string;
  threshold_days: 90 | 30 | 7;
  channel: AlertChannel;
  status: AlertStatus;
  created_at: string;
}
