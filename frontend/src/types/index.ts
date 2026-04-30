/*
 * Volt Voice — shared types.
 * These shapes are the implied API contract for backend handoff.
 * See /docs/data-shapes.md for the canonical reference.
 */

export type Role = 'admin' | 'manager' | 'analyst' | 'viewer';

export interface Workspace {
  id: string;
  name: string;
  logo: string;
  industry: string;
  region: string;
  currency: 'INR' | 'AED' | 'USD';
  timezone: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  workspaces: string[];
}

export interface VoiceAgent {
  id: string;
  workspaceId: string;
  name: string;
  voice: string;
  language: string;
  description: string;
  status: 'active' | 'paused' | 'draft';
  model: string;
  createdAt: string;
}

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'completed'
  | 'paused';

export interface ContactList {
  fileName: string;
  uploadedAt: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicates: number;
  columnMapping: Record<string, string>;
}

export interface CampaignSchedule {
  type: 'immediate' | 'scheduled';
  startsAt?: string;
  timezone: string;
}

export interface CampaignMetrics {
  baseUploaded: number;
  callsInitiated: number;
  callsConnected: number;
  callsAnswered: number;
  callsFailed: number;
  avgCallDuration: number;
  totalCost: number;
}

export interface Campaign {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  voiceAgentId: string;
  status: CampaignStatus;
  contactList: ContactList;
  schedule: CampaignSchedule;
  metrics: CampaignMetrics;
  createdBy: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export type CallStatus =
  | 'initiated'
  | 'ringing'
  | 'connected'
  | 'answered'
  | 'completed'
  | 'failed'
  | 'abandoned';

export type FailureReason =
  | 'busy'
  | 'not_reachable'
  | 'invalid_number'
  | 'dnd'
  | 'network_error'
  | 'customer_hung_up'
  | 'other';

export interface Turn {
  index: number;
  role: 'agent' | 'customer';
  text: string;
  startMs: number;
  endMs: number;
}

export interface Entity {
  type: 'amount' | 'date' | 'product' | 'reference' | 'other';
  label: string;
  value: string;
  turnIndex: number;
}

export interface ToolCall {
  name: string;
  argsPreview: string;
  resultPreview: string;
  durationMs: number;
  status: 'success' | 'error';
  turnIndex: number;
}

export interface CallInsights {
  primaryIntent: string;
  secondaryIntents: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  sentimentByTurn: number[];
  entities: Entity[];
  outcome: string;
  toolCalls: ToolCall[];
}

export interface CallRecording {
  url: string;
  durationMs: number;
  fileSizeBytes: number;
}

export interface Call {
  id: string;
  workspaceId: string;
  campaignId: string;
  voiceAgentId: string;
  phoneNumber: string;
  customerName?: string;
  contactAttributes: Record<string, string>;
  initiatedAt: string;
  connectedAt?: string;
  answeredAt?: string;
  endedAt?: string;
  duration: number;
  status: CallStatus;
  failureReason?: FailureReason;
  recording?: CallRecording;
  transcript?: Turn[];
  insights?: CallInsights;
  reviewed: boolean;
  flagged: boolean;
  notes?: string;
  tags: string[];
  cost: number;
}

/*
 * Calls are returned in two shapes from the API:
 *   - CallSummary  → list endpoints (tables, charts, KPIs)
 *   - CallDetail   → drawer endpoint (transcript, insights, recording)
 *
 * Backend contract:
 *   GET /calls?...            → CallSummary[]
 *   GET /calls/:id/detail     → CallDetail
 *
 * Joining a summary + detail by id reconstructs the full Call.
 */
export interface CallSummary {
  id: string;
  workspaceId: string;
  campaignId: string;
  voiceAgentId: string;
  phoneNumber: string;
  customerName?: string;
  initiatedAt: string;
  connectedAt?: string;
  answeredAt?: string;
  endedAt?: string;
  duration: number;
  status: CallStatus;
  failureReason?: FailureReason;
  primaryIntent?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  hasRecording: boolean;
  reviewed: boolean;
  flagged: boolean;
  tags: string[];
  cost: number;
}

export interface CallDetail {
  id: string;
  contactAttributes: Record<string, string>;
  recording?: CallRecording;
  transcript?: Turn[];
  insights?: CallInsights;
  notes?: string;
}
