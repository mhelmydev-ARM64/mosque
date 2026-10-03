import type { Timestamp } from 'firebase/firestore';

export type UserStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'suspended';
export type GlobalRole = 'member' | 'admin' | 'superAdmin';

export interface AppUser {
  uid: string;
  name: string;
  phone: string;
  status: UserStatus;
  role: GlobalRole;
  globalPermissions: string[];
  committeeIds: string[];
  decisionReason?: string;
  reviewedBy?: string;
  reviewedAt?: Timestamp | null;
  createdAt?: Timestamp | null;
}

export type ApprovalMessageStatus = 'open' | 'under_review' | 'resolved';

export interface AdminApprovalMessage {
  uid: string;
  name: string;
  phone: string;
  status: ApprovalMessageStatus;
  createdAt?: Timestamp | null;
  resolvedAt?: Timestamp | null;
}

export interface Profile {
  uid: string;
  name: string;
  phone?: string;
  committeeIds: string[];
  createdAt?: Timestamp | null;
}

export interface Committee {
  id: string;
  name: string;
  colorKey: string;
  status: 'active' | 'archived';
  teamWidePermissions: string[];
  createdBy?: string;
  createdAt?: Timestamp | null;
}

export interface CommitteeMembership {
  uid: string;
  role: 'member' | 'manager';
  grants: string[];
  denies: string[];
  status: 'active';
}

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean';

export interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  defaultValue?: string | number | boolean | string[] | null;
  searchable?: boolean;
}

export interface StudentTemplate {
  fields: TemplateField[];
  fieldKeys: string[];
  requiredKeys: string[];
  version: number;
  updatedAt?: Timestamp | null;
}

export type MemorizationLevel = 'none' | 'beginner' | 'intermediate' | 'advanced' | 'hafiz';

export interface Student {
  id: string;
  committeeId: string;
  name: string;
  values: Record<string, unknown>;
  searchTokens: string[];
  normalizedName: string;
  points: number;
  memorizationLevel: MemorizationLevel;
  archived: boolean;
  templateVersion: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type RequestType =
  | 'formatting'
  | 'support'
  | 'resources'
  | 'inquiry'
  | 'income'
  | 'expense'
  | 'manual_income'
  | 'manual_expense';

export type RequestStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'cancelled';

export interface RequestDoc {
  id: string;
  type: RequestType;
  createdBy: string;
  createdByName: string;
  senderCommitteeId: string;
  destinationCommitteeId: string;
  title: string;
  body: string;
  amount?: number | null;
  currency?: string | null;
  direction?: 'income' | 'expense' | null;
  status: RequestStatus;
  decisionReason?: string;
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: Timestamp | null;
  executedBy?: string;
  executedByName?: string;
  executedAt?: Timestamp | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface RoutingRule {
  type: RequestType;
  mode: 'fixed' | 'sender_choice';
  committeeId?: string | null;
  updatedAt?: Timestamp | null;
}

export type LedgerDirection = 'income' | 'expense';

export interface LedgerEntry {
  id: string;
  requestId: string;
  committeeId: string;
  type: RequestType;
  direction: LedgerDirection;
  amount: number;
  currency: string;
  note: string;
  executedBy: string;
  executedByName: string;
  executedAt?: Timestamp | null;
  createdAt?: Timestamp | null;
}

export type SecurityEventKind =
  | 'finance.executed'
  | 'user.approved'
  | 'user.rejected'
  | 'user.suspended'
  | 'request.cancelled'
  | 'student.hard_deleted'
  | 'channel.message_hidden';

export interface SecurityEvent {
  kind: SecurityEventKind;
  actorUid: string;
  targetId: string;
  detail?: string;
  at?: Timestamp | null;
}

export type ChannelType = 'announcements' | 'discussion';
export type ChannelAudience = 'allApproved' | 'committees';

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  audience: ChannelAudience;
  committeeIds: string[];
  status: 'active' | 'archived';
  createdBy: string;
  createdAt?: Timestamp | null;
  lastActivityAt?: Timestamp | null;
}

export interface ChannelMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  hidden: boolean;
  createdAt?: Timestamp | null;
}

export interface ChannelRead {
  uid: string;
  channelId: string;
  lastReadMessageId: string;
  lastReadAt?: Timestamp | null;
}
