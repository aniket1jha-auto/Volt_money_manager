/*
 * Human-readable labels for vocabulary enums (intents, failure reasons,
 * outcomes). Backend should treat these as a managed vocabulary; this file
 * is the UI-side display table.
 */
import type { FailureReason } from '@/types';

export const INTENT_LABEL: Record<string, string> = {
  loan_inquiry: 'Loan inquiry',
  emi_status: 'EMI status',
  repayment_intent: 'Repayment intent',
  payment_promise: 'Payment promise',
  kyc_pending: 'KYC pending',
  application_status: 'Application status',
  callback_request: 'Callback request',
  document_request: 'Document request',
  balance_inquiry: 'Balance inquiry',
  renewal_inquiry: 'Renewal inquiry',
  complaint: 'Complaint',
  dispute_charge: 'Charge dispute',
  financial_hardship: 'Financial hardship',
  wrong_number: 'Wrong number',
  agent_handoff_request: 'Agent handoff',
};

export const FAILURE_REASON_LABEL: Record<FailureReason, string> = {
  busy: 'Busy',
  not_reachable: 'Not reachable',
  invalid_number: 'Invalid number',
  dnd: 'DND',
  network_error: 'Network error',
  customer_hung_up: 'Customer hung up',
  other: 'Other',
};

export const OUTCOME_LABEL: Record<string, string> = {
  agreed_to_pay: 'Agreed to pay',
  partial_commitment: 'Partial commitment',
  no_resolution: 'No resolution',
  committed_amount: 'Committed amount',
  requested_grace_period: 'Requested grace period',
  shared_terms: 'Shared terms',
  requested_callback: 'Requested callback',
  lost_interest: 'Lost interest',
  provided_status: 'Provided status',
  escalated_to_team: 'Escalated to team',
  requested_statement: 'Requested statement',
  kyc_link_shared: 'KYC link shared',
  agreed_to_complete: 'Agreed to complete',
  expressed_difficulty: 'Expressed difficulty',
  callback_scheduled: 'Callback scheduled',
  email_sent: 'Email sent',
  whatsapp_sent: 'WhatsApp sent',
  requested_physical: 'Requested physical copy',
  provided_balance: 'Provided balance',
  ticket_created: 'Ticket created',
  resolved_inline: 'Resolved inline',
  restructuring_offered: 'Restructuring offered',
  grace_period_offered: 'Grace period offered',
  contact_removed: 'Contact removed',
  transferred_to_human: 'Transferred to human',
};

/** Fallback formatter: snake_case → Sentence case */
export function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function intentLabel(intent: string): string {
  return INTENT_LABEL[intent] ?? humanize(intent);
}

export function failureReasonLabel(reason: FailureReason): string {
  return FAILURE_REASON_LABEL[reason] ?? humanize(reason);
}

export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABEL[outcome] ?? humanize(outcome);
}
