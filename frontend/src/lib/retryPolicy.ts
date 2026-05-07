/*
 * Mapping between user-facing retry conditions and Plivo's numeric
 * `hangup_cause` codes. The UI exposes simple categories; the backend
 * uses these codes to decide whether to re-queue a call.
 *
 * Source: https://www.plivo.com/docs/voice/troubleshooting/hangup-causes
 *
 * If Plivo adds new cause codes or the team switches telco providers,
 * this file is the single place to update.
 */
import type { RetryConditions } from '@/types';

export type PlivoHangupCode = string;     // numeric string, e.g. '3000'

export interface PlivoCause {
  code: PlivoHangupCode;
  label: string;
}

/** Plivo cause codes covered by each retry condition. */
export const PLIVO_CAUSE_CODES: Record<keyof Omit<RetryConditions, 'shortAnswerThresholdSec'>, PlivoCause[]> = {
  shortAnswer: [
    // Any code where call.status was 'completed' but duration < threshold.
    // The dialer evaluates this client-side from the call record, not
    // from a hangup_cause alone.
  ],
  noAnswer: [
    { code: '3000', label: 'No Answer' },
    { code: '6010', label: 'Ring Timeout Reached' },
  ],
  busy: [
    { code: '3010', label: 'Busy Line' },
    { code: '3100', label: 'Busy everywhere' },
    { code: '3090', label: 'Network congestion from carrier' },
  ],
  carrierError: [
    { code: '3070', label: 'Request timeout (carrier)' },
    { code: '3080', label: 'Internal server error from carrier' },
    { code: '5000', label: 'Network Error' },
    { code: '6020', label: 'Media Timeout' },
  ],
  voicemail: [
    { code: '9100', label: 'Machine Detected' },
  ],
};

/**
 * The full set of Plivo cause codes that map to *any* retry condition,
 * deduplicated. Useful for backend retry-eligibility checks.
 */
export function plivoCodesForConditions(conditions: RetryConditions): PlivoHangupCode[] {
  const out = new Set<PlivoHangupCode>();
  if (conditions.noAnswer)     PLIVO_CAUSE_CODES.noAnswer.forEach((c) => out.add(c.code));
  if (conditions.busy)         PLIVO_CAUSE_CODES.busy.forEach((c) => out.add(c.code));
  if (conditions.carrierError) PLIVO_CAUSE_CODES.carrierError.forEach((c) => out.add(c.code));
  if (conditions.voicemail)    PLIVO_CAUSE_CODES.voicemail.forEach((c) => out.add(c.code));
  return [...out].sort();
}

/** Cause codes that should NEVER trigger a retry, by policy. */
export const NEVER_RETRY_CODES: PlivoCause[] = [
  { code: '3020', label: 'Rejected' },
  { code: '3040', label: 'Forbidden / blocked' },
  { code: '3110', label: 'Declined' },
  { code: '3130', label: 'Spam block' },
  { code: '2000', label: 'Invalid destination' },
  { code: '2010', label: 'Out of service' },
  { code: '2030', label: 'Country barred' },
  { code: '2040', label: 'Number barred' },
  { code: '3050', label: 'Unallocated number' },
  { code: '3120', label: "User doesn't exist" },
  { code: '4000', label: 'Normal Hangup' },
];

export const RETRY_INTERVAL_PRESETS: { value: number; label: string }[] = [
  { value: 10,    label: '10 minutes' },
  { value: 30,    label: '30 minutes' },
  { value: 60,    label: '1 hour' },
  { value: 120,   label: '2 hours' },
  { value: 240,   label: '4 hours' },
  { value: 720,   label: '12 hours' },
  { value: 1440,  label: 'Next day' },
];
