#!/usr/bin/env node
/*
 * Deterministic mock data generator for Volt Voice.
 * Run: `npm run generate-mocks`
 *
 * Writes JSON files into frontend/src/mocks/data/. Same seed → same dataset.
 * Backend devs can inspect actual records to understand the contracts.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'src', 'mocks', 'data');
mkdirSync(OUT_DIR, { recursive: true });

// ────────────────────────────────────────────────────────────────────
// Deterministic RNG (mulberry32)
// ────────────────────────────────────────────────────────────────────
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260430);
const rnd = () => rand();
const randInt = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const pickN = (arr, n) => {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
  }
  return out;
};
const weighted = (entries) => {
  // entries: [[value, weight], ...]
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
};

// ────────────────────────────────────────────────────────────────────
// Reference pools
// ────────────────────────────────────────────────────────────────────
const FIRST_NAMES = [
  'Aarav', 'Aditi', 'Akash', 'Amit', 'Anjali', 'Ankit', 'Arjun', 'Aryan',
  'Bhavna', 'Chitra', 'Deepa', 'Devansh', 'Divya', 'Gaurav', 'Harini',
  'Ishaan', 'Jaya', 'Karan', 'Karthik', 'Kavya', 'Krishna', 'Lakshmi',
  'Madhuri', 'Manish', 'Meera', 'Naveen', 'Neha', 'Nikhil', 'Pallavi',
  'Pooja', 'Pranav', 'Priya', 'Raghav', 'Rahul', 'Rajesh', 'Rakesh',
  'Ramesh', 'Rashmi', 'Riya', 'Rohan', 'Rupali', 'Sahana', 'Sandeep',
  'Sanjay', 'Saurabh', 'Shanaya', 'Shreya', 'Siddharth', 'Sneha', 'Sonia',
  'Srikanth', 'Sumit', 'Suresh', 'Swati', 'Tanvi', 'Tarun', 'Uday',
  'Varun', 'Vidya', 'Vijay', 'Vikram', 'Vinay', 'Yash', 'Zara',
];
const LAST_NAMES = [
  'Sharma', 'Patel', 'Kumar', 'Singh', 'Mehta', 'Reddy', 'Iyer', 'Nair',
  'Verma', 'Gupta', 'Joshi', 'Das', 'Banerjee', 'Chatterjee', 'Mukherjee',
  'Pillai', 'Menon', 'Rao', 'Naidu', 'Bhat', 'Desai', 'Shah', 'Khanna',
  'Kapoor', 'Malhotra', 'Bose', 'Sen', 'Roy', 'Mishra', 'Tiwari',
  'Agarwal', 'Jain', 'Bhatt', 'Pandey', 'Saxena', 'Chopra', 'Sinha',
  'Trivedi', 'Pillai', 'Krishnan', 'Subramanian', 'Raman', 'Hegde',
];

// Intent vocabulary — outcome labels the AI tags onto a call once it
// ends. They describe WHAT HAPPENED, not what the customer asked about.
const INTENTS = [
  'kyc_completed_on_call',
  'application_submitted',
  'interested_will_apply',
  'call_me_later',
  'not_interested',
  'payment_promised',
  'payment_already_done',
  'documents_requested',
  'complaint_raised',
  'not_eligible',
  'requesting_branch_visit',
  'wrong_number',
  'dnd_requested',
  'transferred_to_human',
  'customer_unavailable',
];

const FAILURE_REASONS = [
  ['busy', 30],
  ['not_reachable', 25],
  ['customer_hung_up', 18],
  ['network_error', 10],
  ['invalid_number', 8],
  ['dnd', 6],
  ['other', 3],
];

const OUTCOMES_BY_INTENT = {
  kyc_completed_on_call:    ['kyc_done_on_call', 'documents_verified'],
  application_submitted:    ['application_filed', 'application_pending_docs'],
  interested_will_apply:    ['shared_terms', 'will_decide_later', 'requested_email_followup'],
  call_me_later:            ['callback_scheduled', 'callback_requested_no_time'],
  not_interested:           ['noted_disinterest', 'noted_already_has_loan'],
  payment_promised:         ['agreed_to_pay', 'committed_amount', 'partial_commitment'],
  payment_already_done:     ['provided_status', 'requested_statement'],
  documents_requested:      ['email_sent', 'whatsapp_sent', 'requested_physical'],
  complaint_raised:         ['ticket_created', 'escalated_to_team', 'resolved_inline'],
  not_eligible:             ['flagged_ineligible', 'requested_review'],
  requesting_branch_visit:  ['branch_appointment_offered', 'noted_branch_preference'],
  wrong_number:             ['contact_removed'],
  dnd_requested:            ['dnd_recorded'],
  transferred_to_human:     ['transferred_to_human'],
  customer_unavailable:     ['no_resolution', 'callback_requested_no_time'],
};

const ENTITY_TYPES = ['amount', 'date', 'product', 'reference', 'other'];

// ────────────────────────────────────────────────────────────────────
// Workspace + user
// ────────────────────────────────────────────────────────────────────
const workspace = {
  id: 'ws_volt',
  name: 'Volt Money',
  logo: '/logos/volt-money.svg',
  industry: 'Consumer Lending',
  region: 'IN',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  createdAt: '2026-01-15T09:30:00.000Z',
};

const user = {
  id: 'user_001',
  email: 'admin@voltmoney.in',
  name: 'Priya Sharma',
  role: 'admin',
  workspaces: ['ws_volt'],
};

// ────────────────────────────────────────────────────────────────────
// Voice agents
// ────────────────────────────────────────────────────────────────────
const voiceAgents = [
  {
    id: 'agent_loan_recovery',
    workspaceId: 'ws_volt',
    name: 'Loan Recovery Agent',
    voice: 'Kavya',
    language: 'hi-IN',
    description:
      'Handles overdue EMIs and collections conversations. Negotiates payment commitments, offers restructuring, escalates hardship cases.',
    status: 'active',
    model: 'gpt-4o-realtime',
    createdAt: '2026-01-22T10:00:00.000Z',
  },
  {
    id: 'agent_emi_reminder',
    workspaceId: 'ws_volt',
    name: 'EMI Reminder Agent',
    voice: 'Arjun',
    language: 'hi-IN',
    description:
      'Pre-due-date reminders, confirms EMI amount and date, captures payment intent.',
    status: 'active',
    model: 'gpt-4o-realtime',
    createdAt: '2026-01-25T14:15:00.000Z',
  },
  {
    id: 'agent_application_status',
    workspaceId: 'ws_volt',
    name: 'Application Status Agent',
    voice: 'Meera',
    language: 'en-IN',
    description:
      'Outbound updates for in-flight loan applications. KYC nudges, document requests, approval/decline conveys.',
    status: 'active',
    model: 'gpt-4o-realtime',
    createdAt: '2026-02-08T11:00:00.000Z',
  },
];

// ────────────────────────────────────────────────────────────────────
// Campaigns — 25 across all statuses
// ────────────────────────────────────────────────────────────────────
// `kind` controls call-generation for the seed dataset only. The final
// Campaign.status written into JSON is just 'active' | 'inactive':
//   running   → active (currently dialing)
//   scheduled → active (live but waiting for startsAt)
//   completed → inactive (finished)
//   draft     → inactive (never started)
const CAMPAIGN_TEMPLATES = [
  // running (5)
  { name: 'EMI Reminder — April 2026',          agent: 'agent_emi_reminder',      kind: 'running',   base: 2100 },
  { name: 'Loan Recovery — 30 DPD',             agent: 'agent_loan_recovery',     kind: 'running',   base: 920 },
  { name: 'Loan Recovery — 60 DPD',             agent: 'agent_loan_recovery',     kind: 'running',   base: 460 },
  { name: 'KYC Pending — Personal Loan',        agent: 'agent_application_status',kind: 'running',   base: 670 },
  { name: 'EMI Reminder — Premium Tier',        agent: 'agent_emi_reminder',      kind: 'running',   base: 340 },
  // completed (15)
  { name: 'EMI Reminder — March 2026',          agent: 'agent_emi_reminder',      kind: 'completed', base: 2090 },
  { name: 'EMI Reminder — February 2026',       agent: 'agent_emi_reminder',      kind: 'completed', base: 1975 },
  { name: 'Loan Recovery — Q1 2026 Sweep',      agent: 'agent_loan_recovery',     kind: 'completed', base: 1115 },
  { name: 'Application Status — Feb intake',    agent: 'agent_application_status',kind: 'completed', base: 810 },
  { name: 'KYC Pending — Personal Loan (Jan)',  agent: 'agent_application_status',kind: 'completed', base: 740 },
  { name: 'KYC Pending — Auto Loan (Feb)',      agent: 'agent_application_status',kind: 'completed', base: 380 },
  { name: 'Loan Recovery — 90+ DPD Q1',         agent: 'agent_loan_recovery',     kind: 'completed', base: 270 },
  { name: 'Renewal Outreach — Personal Loan',   agent: 'agent_application_status',kind: 'completed', base: 440 },
  { name: 'Document Reminder — Income Proof',   agent: 'agent_application_status',kind: 'completed', base: 310 },
  { name: 'EMI Bounce Recovery — March',        agent: 'agent_loan_recovery',     kind: 'completed', base: 560 },
  { name: 'Cross-Sell — Top-up Loans',          agent: 'agent_application_status',kind: 'completed', base: 725 },
  { name: 'Welcome Calls — New Disbursements (Jan)', agent: 'agent_application_status', kind: 'completed', base: 360 },
  { name: 'Welcome Calls — New Disbursements (Feb)', agent: 'agent_application_status', kind: 'completed', base: 405 },
  { name: 'Festival Top-up Offer — Holi 2026',  agent: 'agent_application_status',kind: 'completed', base: 1200 },
  { name: 'NPA Restructure Outreach — Q4 2025', agent: 'agent_loan_recovery',     kind: 'completed', base: 190 },
  // scheduled (3) — active in status, but startsAt is in the future
  { name: 'EMI Reminder — May 2026',            agent: 'agent_emi_reminder',      kind: 'scheduled', base: 2155 },
  { name: 'KYC Pending — Q2 sweep',             agent: 'agent_application_status',kind: 'scheduled', base: 590 },
  { name: 'Cross-Sell — Pre-approved Top-up (May)', agent: 'agent_application_status', kind: 'scheduled', base: 1025 },
  // draft (2)
  { name: 'EMI Reminder — Premium Tier (Draft)', agent: 'agent_emi_reminder',     kind: 'draft',     base: 0 },
  { name: 'Recovery — Hardship Cases (Draft)',  agent: 'agent_loan_recovery',     kind: 'draft',     base: 0 },
];

// Anchor "today" deterministically: 2026-04-30
const NOW = new Date('2026-04-30T11:00:00.000Z').getTime();
const ONE_DAY = 86_400_000;
const ONE_MIN = 60_000;

function isoDaysAgo(days, hours = 9) {
  const d = new Date(NOW - days * ONE_DAY);
  d.setUTCHours(hours, 0, 0, 0);
  return d.toISOString();
}
function isoDaysFromNow(days, hours = 9) {
  return isoDaysAgo(-days, hours);
}

const COLUMN_MAPPING_PRESET = {
  phone: 'phone_number',
  customer_name: 'customer_name',
  loan_amount: 'loan_amount',
  due_date: 'due_date',
  last_emi_paid: 'last_interaction',
  product: 'custom_var_1',
  branch: 'custom_var_2',
};

function makeContactList(name, base) {
  const fileName = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '.csv';
  const invalid = Math.round(base * (0.01 + rnd() * 0.03));
  const dups = Math.round(base * (0.005 + rnd() * 0.01));
  return {
    fileName,
    uploadedAt: isoDaysAgo(randInt(1, 60), randInt(8, 18)),
    totalRows: base + invalid + dups,
    validRows: base,
    invalidRows: invalid,
    duplicates: dups,
    columnMapping: COLUMN_MAPPING_PRESET,
  };
}

function makeMetrics(base, kind) {
  if (kind === 'draft') {
    return zeroMetrics();
  }
  if (kind === 'scheduled') {
    return zeroMetrics(base);
  }
  // For running/completed: simulate funnel.
  const initiatedRate = kind === 'completed' ? 1 : 0.45 + rnd() * 0.4;
  const initiated = Math.round(base * initiatedRate);
  const connectedRate = 0.78 + rnd() * 0.1;
  const connected = Math.round(initiated * connectedRate);
  const answeredRate = 0.85 + rnd() * 0.08;
  const answered = Math.round(connected * answeredRate);
  const failed = initiated - connected;
  const avg = randInt(95, 220);
  const cost = Math.round(initiated * (2.2 + rnd() * 0.5) * 100) / 100;
  return {
    baseUploaded: base,
    callsInitiated: initiated,
    callsConnected: connected,
    callsAnswered: answered,
    callsFailed: failed,
    avgCallDuration: avg,
    totalCost: cost,
  };
}
function zeroMetrics(baseUploaded = 0) {
  return {
    baseUploaded,
    callsInitiated: 0,
    callsConnected: 0,
    callsAnswered: 0,
    callsFailed: 0,
    avgCallDuration: 0,
    totalCost: 0,
  };
}

/*
 * Pick a plain-English description for a campaign based on its name.
 * This was previously the "goal" copy — repurposed as the operator's
 * description of what the campaign is for.
 */
function makeDescription(name) {
  const lower = name.toLowerCase();
  if (lower.includes('emi reminder') || lower.includes('emi bounce')) {
    return 'Reach customers ahead of their EMI date to lock in payment commitments.';
  }
  if (lower.includes('loan recovery') || lower.includes('npa') || lower.includes('restructure')) {
    return 'Reach dues-overdue customers and capture a path back to repayment.';
  }
  if (lower.includes('kyc')) {
    return 'Drive eKYC completion live on the call so disbursals can move forward.';
  }
  if (lower.includes('application status')) {
    return 'Reach pending applicants and close out outstanding documentation.';
  }
  if (lower.includes('cross-sell') || lower.includes('top-up') || lower.includes('renewal') || lower.includes('festival')) {
    return 'Surface qualified leads who are ready to apply for a follow-up offer.';
  }
  if (lower.includes('document reminder')) {
    return 'Chase pending documents from customers mid-application.';
  }
  if (lower.includes('welcome')) {
    return 'Onboard freshly-disbursed customers with a friendly welcome call.';
  }
  return 'Resolve customer queries on this segment and capture next steps.';
}

/*
 * Friendly intent labels + LLM-facing descriptions, keyed by the
 * post-call outcome vocabulary. Used by the generator to populate the
 * feedback-intents key/description pairs for each campaign.
 */
const INTENT_NAMES = {
  payment_promised:        'Payment promised',
  payment_already_done:    'Already paid',
  kyc_completed_on_call:   'KYC completed on call',
  documents_requested:     'Documents requested',
  application_submitted:   'Application submitted',
  interested_will_apply:   'Interested — will apply',
  not_interested:          'Not interested',
  call_me_later:           'Call me later',
  complaint_raised:        'Complaint raised',
  requesting_branch_visit: 'Will visit branch',
};

const INTENT_DESCRIPTIONS = {
  payment_promised:        'Customer committed to making the payment by a specific date.',
  payment_already_done:    'Customer says the payment has already been made (verify against records).',
  kyc_completed_on_call:   'Customer completed eKYC verification during the call and is ready for the next step.',
  documents_requested:     'Customer agreed to share or upload pending documents after the call.',
  application_submitted:   'Customer submitted (or agreed to submit on call) the application form.',
  interested_will_apply:   'Customer expressed clear interest and intends to apply.',
  not_interested:          'Customer explicitly declined the offer or product.',
  call_me_later:           'Customer asked to be contacted again at a more convenient time.',
  complaint_raised:        'Customer raised a service complaint that needs follow-up by support.',
  requesting_branch_visit: 'Customer prefers to handle the next step at a branch in person.',
};

/*
 * Pick a calling window for the campaign. Most campaigns follow the
 * fintech default of 9:00–19:00 Mon–Sat (TRAI / RBI-friendly), with
 * variation for product-type campaigns that need different hours.
 */
function makeCallingWindow(name) {
  const lower = name.toLowerCase();
  // EMI / recovery — earlier start and Mon–Sat to catch the customer.
  if (lower.includes('emi') || lower.includes('recovery') || lower.includes('npa') || lower.includes('restructure')) {
    return {
      enabled: true,
      days: [1, 2, 3, 4, 5, 6],
      startTime: '09:00',
      endTime: '19:00',
    };
  }
  // KYC / onboarding — narrower business hours, weekdays only.
  if (lower.includes('kyc') || lower.includes('welcome')) {
    return {
      enabled: true,
      days: [1, 2, 3, 4, 5],
      startTime: '10:00',
      endTime: '18:00',
    };
  }
  // Cross-sell / festival — broader window incl. Sat, lighter cadence.
  if (lower.includes('cross-sell') || lower.includes('top-up') || lower.includes('renewal') || lower.includes('festival')) {
    return {
      enabled: true,
      days: [1, 2, 3, 4, 5, 6],
      startTime: '10:00',
      endTime: '20:00',
    };
  }
  // Sane default for everything else.
  return {
    enabled: true,
    days: [1, 2, 3, 4, 5, 6],
    startTime: '09:00',
    endTime: '19:00',
  };
}

/*
 * Pick the feedback intents (post-call outcomes) that an operator would
 * most likely want to track for this campaign type. Each intent carries
 * a name + description used by the LLM to classify call outcomes.
 */
function makeFeedbackIntents(name, kind) {
  if (kind === 'draft' || kind === 'scheduled') return undefined;
  if (kind === 'completed' && rnd() < 0.4) return undefined;

  const lower = name.toLowerCase();
  const keys = new Set();

  if (lower.includes('emi reminder') || lower.includes('emi bounce') || lower.includes('loan recovery') || lower.includes('npa') || lower.includes('restructure')) {
    keys.add('payment_promised');
    keys.add('payment_already_done');
    keys.add('call_me_later');
    keys.add('complaint_raised');
  } else if (lower.includes('kyc')) {
    keys.add('kyc_completed_on_call');
    keys.add('documents_requested');
    keys.add('requesting_branch_visit');
    keys.add('call_me_later');
  } else if (lower.includes('cross-sell') || lower.includes('top-up') || lower.includes('renewal') || lower.includes('festival') || lower.includes('welcome')) {
    keys.add('application_submitted');
    keys.add('interested_will_apply');
    keys.add('call_me_later');
    keys.add('not_interested');
  } else if (lower.includes('application status')) {
    keys.add('documents_requested');
    keys.add('application_submitted');
    keys.add('call_me_later');
  } else if (lower.includes('document')) {
    keys.add('documents_requested');
    keys.add('call_me_later');
  } else {
    keys.add('call_me_later');
    keys.add('not_interested');
  }

  return [...keys].map((k) => ({
    name: INTENT_NAMES[k] ?? k,
    description: INTENT_DESCRIPTIONS[k] ?? '',
  }));
}

const campaigns = CAMPAIGN_TEMPLATES.map((tpl, i) => {
  const id = `camp_${String(i + 1).padStart(3, '0')}`;
  const kind = tpl.kind;
  // Final UI-facing status: binary.
  //   running / scheduled → active
  //   completed / draft   → inactive
  const status = (kind === 'running' || kind === 'scheduled') ? 'active' : 'inactive';
  const metrics = makeMetrics(tpl.base, kind);
  const contactList = makeContactList(tpl.name, tpl.base);

  let createdAt, startedAt, completedAt, schedule;
  if (kind === 'completed') {
    const start = randInt(45, 90);
    createdAt = isoDaysAgo(start + 2);
    startedAt = isoDaysAgo(start);
    completedAt = isoDaysAgo(start - randInt(2, 7));
    schedule = { type: 'immediate', timezone: 'Asia/Kolkata' };
  } else if (kind === 'running') {
    const start = randInt(2, 14);
    createdAt = isoDaysAgo(start + 1);
    startedAt = isoDaysAgo(start);
    schedule = { type: 'immediate', timezone: 'Asia/Kolkata' };
  } else if (kind === 'scheduled') {
    createdAt = isoDaysAgo(randInt(1, 6));
    schedule = {
      type: 'scheduled',
      startsAt: isoDaysFromNow(randInt(1, 14), 10),
      timezone: 'Asia/Kolkata',
    };
  } else {
    createdAt = isoDaysAgo(randInt(0, 4));
    schedule = { type: 'immediate', timezone: 'Asia/Kolkata' };
  }

  return {
    id,
    workspaceId: 'ws_volt',
    name: tpl.name,
    voiceAgentId: tpl.agent,
    status,
    contactList,
    schedule,
    metrics,
    description: makeDescription(tpl.name),
    feedbackIntents: makeFeedbackIntents(tpl.name, kind),
    callingWindow: makeCallingWindow(tpl.name),
    createdBy: 'user_001',
    createdAt,
    startedAt,
    completedAt,
    // Internal-only — drives call generation. Stripped before write.
    _kind: kind,
  };
});

// ────────────────────────────────────────────────────────────────────
// Calls — distributed across active + completed campaigns
// ────────────────────────────────────────────────────────────────────
function indianPhone() {
  const seed = ['7', '8', '9'][randInt(0, 2)];
  let n = seed;
  for (let i = 0; i < 9; i++) n += String(randInt(0, 9));
  return '+91' + n;
}

function customerName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function moneyAmount() {
  const buckets = [
    [50_000, 200_000],
    [200_000, 500_000],
    [500_000, 1_500_000],
    [1_500_000, 5_000_000],
  ];
  const [min, max] = buckets[weighted([[0, 30], [1, 40], [2, 25], [3, 5]])];
  return Math.round((min + rnd() * (max - min)) / 1000) * 1000;
}

function formatINR(v) {
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1)}Cr`;
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${v}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function dueDate() {
  return `${randInt(1, 28)} ${pick(MONTHS)}`;
}

// ────────────────────────────────────────────────────────────────────
// Transcript templates by intent
// ────────────────────────────────────────────────────────────────────
function transcriptFor(intent, agentName, customer, attrs) {
  const greeting = {
    text: `Hello, am I speaking with ${customer.firstName}? This is ${agentName} calling from Volt Money.`,
    role: 'agent',
  };

  const customerHello = pick([
    { text: 'Yes, this is them. What is this regarding?', role: 'customer' },
    { text: 'Yes, speaking. Please go ahead.', role: 'customer' },
    { text: "Yes, who's this?", role: 'customer' },
    { text: 'Hi, yes. Is this important? I am at work.', role: 'customer' },
  ]);

  const close = pick([
    { text: 'Thank you for your time today. Have a great day!', role: 'agent' },
    { text: 'Appreciate you taking the call. Goodbye.', role: 'agent' },
    { text: 'Thanks, that helps. Speak soon.', role: 'agent' },
  ]);
  const customerClose = pick([
    { text: 'Okay, thank you.', role: 'customer' },
    { text: 'Alright, bye.', role: 'customer' },
    { text: 'Thanks, goodbye.', role: 'customer' },
  ]);

  const middle = [];
  switch (intent) {
    case 'kyc_completed_on_call':
      middle.push(
        { text: 'Your loan application is approved pending KYC. We can complete it right now over this call. Shall we proceed?', role: 'agent' },
        pick([
          { text: 'Yes please, let us do it now.', role: 'customer' },
          { text: 'Sure, what do you need from me?', role: 'customer' },
        ]),
        { text: 'Great. Could you confirm your name as on PAN, and read out the last 4 digits of the Aadhaar?', role: 'agent' },
        { text: 'Yes — name matches. Last four are 4-3-2-1.', role: 'customer' },
        { text: 'Thank you. KYC is now marked complete on our side. You will get a confirmation SMS shortly.', role: 'agent' },
      );
      break;
    case 'application_submitted':
      middle.push(
        { text: `Based on the eligibility I just checked, you qualify for ${attrs.amount}. Would you like to submit the application now?`, role: 'agent' },
        { text: 'Yes, I want to go ahead.', role: 'customer' },
        { text: 'I will lock the rate at 10.49% reducing and submit the form on your behalf. Confirming all details on file are correct?', role: 'agent' },
        { text: 'Correct. Please go ahead.', role: 'customer' },
        { text: 'Application submitted. You will receive an SMS with the application reference and next steps.', role: 'agent' },
      );
      break;
    case 'interested_will_apply':
      middle.push(
        { text: `I see you have shown interest in our loan offer up to ${attrs.amount}. Would you like me to walk you through the terms?`, role: 'agent' },
        pick([
          { text: 'Yes, what is the interest rate? And how long is the tenure?', role: 'customer' },
          { text: 'I am interested but want to compare with my bank first.', role: 'customer' },
        ]),
        { text: 'Of course. Current rate starts at 11.5% reducing with tenures up to 60 months. I can email the full sheet right after this call.', role: 'agent' },
        { text: 'Please email it, I will look at it tonight and apply by next week.', role: 'customer' },
      );
      break;
    case 'call_me_later':
      middle.push(
        { text: 'Could I take five minutes to walk you through the details?', role: 'agent' },
        pick([
          { text: 'I am driving right now, can you call me back at 6pm?', role: 'customer' },
          { text: 'In a meeting. Please try tomorrow morning.', role: 'customer' },
          { text: 'Not a good time. Call me later this week.', role: 'customer' },
        ]),
        { text: 'No problem at all. I will schedule a callback as you mentioned. Thank you for your time today.', role: 'agent' },
      );
      break;
    case 'not_interested':
      middle.push(
        { text: 'I would love to share why this might be a good fit. Just 30 seconds?', role: 'agent' },
        pick([
          { text: 'I appreciate it but I am not looking for a loan right now.', role: 'customer' },
          { text: 'I already have a loan with another bank, I am not interested.', role: 'customer' },
          { text: 'Honestly, please don\'t call me about this anymore.', role: 'customer' },
        ]),
        { text: 'Understood, thank you for letting me know. I will note it on your account.', role: 'agent' },
      );
      break;
    case 'payment_promised':
      middle.push(
        { text: `Calling about the EMI of ${attrs.amount} due on ${attrs.due}. Will you be able to pay on time?`, role: 'agent' },
        pick([
          { text: 'Yes, the funds are arranged. I will pay by tomorrow.', role: 'customer' },
          { text: 'I can pay half this month and the rest by next week.', role: 'customer' },
        ]),
        { text: 'Noted. I have recorded your commitment. Would you like an SMS reminder a day before?', role: 'agent' },
        { text: 'Yes please, an SMS would help.', role: 'customer' },
      );
      break;
    case 'payment_already_done':
      middle.push(
        { text: `Calling about the EMI of ${attrs.amount} due on ${attrs.due}.`, role: 'agent' },
        { text: 'I already paid yesterday morning. Please check on your end.', role: 'customer' },
        { text: `Let me verify... yes, I can see ${attrs.amount} credited yesterday. Apologies for the duplicate reminder.`, role: 'agent' },
        { text: 'No problem, thank you for confirming.', role: 'customer' },
      );
      break;
    case 'documents_requested':
      middle.push(
        { text: 'To proceed we still need your latest salary slip and Aadhaar copy.', role: 'agent' },
        pick([
          { text: 'I can WhatsApp them right now.', role: 'customer' },
          { text: 'Please share the email ID where I should attach them.', role: 'customer' },
        ]),
        { text: 'I will share the official handle by SMS now. Acknowledgement comes within 24 hours.', role: 'agent' },
      );
      break;
    case 'complaint_raised':
      middle.push(
        pick([
          { text: 'I was charged a late fee but I had paid on time! Please refund.', role: 'customer' },
          { text: 'My EMI got debited twice this month, this is the third time it has happened.', role: 'customer' },
        ]),
        { text: 'I am very sorry for the trouble. Let me raise a ticket and have our resolution team contact you within 48 hours.', role: 'agent' },
        { text: 'Please make sure it is resolved this time.', role: 'customer' },
      );
      break;
    case 'not_eligible':
      middle.push(
        { text: 'Let me quickly check your eligibility... I am sorry, based on the latest profile our system has flagged this for review.', role: 'agent' },
        pick([
          { text: 'Why? I had qualified before.', role: 'customer' },
          { text: 'Can someone review it manually?', role: 'customer' },
        ]),
        { text: 'I will request a manual review and someone will get back to you within 3 working days.', role: 'agent' },
      );
      break;
    case 'requesting_branch_visit':
      middle.push(
        { text: 'We can complete the entire process over this call. Shall we proceed?', role: 'agent' },
        { text: 'Honestly, I prefer to walk into the branch. I am not comfortable with phone or online for this.', role: 'customer' },
        { text: 'Of course. Your nearest branch is open 10 to 5, Monday to Saturday. I will SMS you the address.', role: 'agent' },
        { text: 'Thank you, I will visit this week.', role: 'customer' },
      );
      break;
    case 'wrong_number':
      middle.push(
        pick([
          { text: 'I think you have the wrong person. I do not have any loan with Volt Money.', role: 'customer' },
          { text: 'Sorry, this number was previously someone else\'s.', role: 'customer' },
        ]),
        { text: 'Apologies for the inconvenience. I will remove this number from our list right away.', role: 'agent' },
      );
      break;
    case 'dnd_requested':
      middle.push(
        { text: 'I want to share details about a pre-approved offer.', role: 'agent' },
        { text: 'Please put me on Do Not Disturb. I do not want any more calls about this.', role: 'customer' },
        { text: 'Absolutely, I will mark your number as DND immediately. You will not receive any further calls.', role: 'agent' },
      );
      break;
    case 'transferred_to_human':
      middle.push(
        pick([
          { text: 'I would prefer to speak to a human agent please, this is sensitive.', role: 'customer' },
          { text: 'Can you connect me to your manager? I have a specific concern.', role: 'customer' },
        ]),
        { text: 'Of course. Connecting you to our customer success team now, please hold for a moment.', role: 'agent' },
      );
      break;
    case 'customer_unavailable':
      middle.push(
        { text: 'Hello, am I speaking with the right person?', role: 'agent' },
        pick([
          { text: 'I cannot talk right now, will you call back later?', role: 'customer' },
          { text: 'Sorry, I am stepping into a meeting.', role: 'customer' },
        ]),
        { text: 'Of course, I will try again later. Thank you.', role: 'agent' },
      );
      break;
    default:
      middle.push(
        { text: 'How can I help you today?', role: 'agent' },
        { text: 'Just had a quick question.', role: 'customer' },
      );
  }

  const turns = [greeting, customerHello, ...middle, close, customerClose];

  let cursor = 800;
  return turns.map((t, i) => {
    const wordCount = t.text.split(' ').length;
    const speakDur = Math.round(wordCount * 380 + 400 + rnd() * 600);
    const startMs = cursor;
    const endMs = cursor + speakDur;
    cursor = endMs + Math.round(200 + rnd() * 600);
    return { index: i, role: t.role, text: t.text, startMs, endMs };
  });
}

function entitiesFromAttrs(insightsAttrs, intent, transcript) {
  const out = [];
  const moneyIntents = [
    'application_submitted',
    'interested_will_apply',
    'payment_promised',
    'payment_already_done',
  ];
  if (moneyIntents.includes(intent)) {
    out.push({
      type: 'amount',
      label: 'Loan amount',
      value: insightsAttrs.amount,
      turnIndex: Math.min(2, transcript.length - 1),
    });
    out.push({
      type: 'date',
      label: 'Due date',
      value: insightsAttrs.due,
      turnIndex: Math.min(2, transcript.length - 1),
    });
  }
  if (intent === 'kyc_completed_on_call') {
    out.push({ type: 'reference', label: 'KYC reference', value: 'KYC-' + randInt(100000, 999999), turnIndex: 4 });
  }
  return out;
}

function toolCallsFor(intent, transcript) {
  const out = [];
  if (intent === 'payment_already_done' || intent === 'payment_promised') {
    out.push({
      name: 'lookup_loan_status',
      argsPreview: '{ "customer_id": "cust_abc123" }',
      resultPreview: '{ "principal_outstanding": 245000, "next_emi_date": "2026-05-15" }',
      durationMs: randInt(140, 380),
      status: 'success',
      turnIndex: 2,
    });
  }
  if (intent === 'kyc_completed_on_call') {
    out.push({
      name: 'mark_kyc_complete',
      argsPreview: '{ "customer_id": "cust_abc123", "method": "voice_otp" }',
      resultPreview: '{ "kyc_status": "complete", "ref": "KYC-' + randInt(100000, 999999) + '" }',
      durationMs: randInt(220, 460),
      status: 'success',
      turnIndex: 4,
    });
  }
  if (intent === 'application_submitted') {
    out.push({
      name: 'submit_loan_application',
      argsPreview: '{ "customer_id": "cust_abc123", "amount": 250000, "tenure_months": 60 }',
      resultPreview: '{ "application_id": "APP-' + randInt(100000, 999999) + '", "status": "submitted" }',
      durationMs: randInt(280, 520),
      status: 'success',
      turnIndex: 4,
    });
  }
  if (intent === 'complaint_raised') {
    out.push({
      name: 'create_ticket',
      argsPreview: '{ "category": "billing_dispute", "priority": "high" }',
      resultPreview: '{ "ticket_id": "TKT-' + randInt(40000, 49999) + '", "sla_hours": 48 }',
      durationMs: randInt(180, 350),
      status: 'success',
      turnIndex: 3,
    });
  }
  if (intent === 'dnd_requested') {
    out.push({
      name: 'add_to_dnd',
      argsPreview: '{ "phone": "+91XXXXXXXXXX", "reason": "customer_request" }',
      resultPreview: '{ "added": true }',
      durationMs: randInt(120, 260),
      status: 'success',
      turnIndex: 2,
    });
  }
  return out;
}

/*
 * LLM-style call summaries — templated by intent + sentiment + outcome.
 * Substitutes the actual call attributes (name, amount, due) so each
 * summary reads like a unique paraphrase rather than canned copy.
 */
const SUMMARY_TEMPLATES = {
  kyc_completed_on_call: [
    "{name} completed KYC live on the call by confirming PAN and Aadhaar last-four. KYC marked complete and SMS confirmation sent.",
    "Customer ({name}) walked through voice-OTP KYC and was verified successfully during the call. No further documentation needed.",
  ],
  application_submitted: [
    "{name} accepted the {amount} eligibility check and submitted the loan application live on the call. Application reference shared via SMS.",
    "Customer ({name}) confirmed personal details and authorised submission of a {amount} application at 10.49% reducing. Submission successful.",
  ],
  interested_will_apply: [
    "{name} expressed interest in a loan up to {amount}. Agent shared current rate and tenure; customer asked for an email and plans to apply this week.",
    "Customer ({name}) wants to compare with their bank before deciding. Agent emailed the rate sheet and noted the customer for a 7-day follow-up.",
  ],
  call_me_later: [
    "{name} could not talk now and asked for a callback later in the day. Callback scheduled and noted on the account.",
    "Customer ({name}) was in a meeting; requested a fresh attempt tomorrow morning. Reschedule recorded.",
  ],
  not_interested: [
    "{name} explicitly declined the offer; said they already have a loan elsewhere. Marked as not interested for the next 90 days.",
    "Customer ({name}) was polite but firmly not interested. Disinterest recorded; suppression cooldown applied.",
  ],
  payment_promised: [
    "{name} promised to pay the EMI of {amount} (due on {due}) within 48 hours. Commitment recorded; SMS reminder scheduled a day before.",
    "Customer ({name}) committed to a partial payment this month with the balance by month-end. Staggered plan captured on the account.",
  ],
  payment_already_done: [
    "{name} reported the EMI of {amount} was paid yesterday. Agent verified the credit on their end and apologised for the duplicate reminder.",
    "Customer ({name}) confirmed payment of {amount} was already cleared. Agent updated the call log to reflect the verified status.",
  ],
  documents_requested: [
    "{name} agreed to share the salary slip and Aadhaar via WhatsApp immediately. Official handle shared; acknowledgement window of 24 hours communicated.",
    "Customer ({name}) requested the documents email; agent shared it on the call and committed to a 24-hour acknowledgement.",
  ],
  complaint_raised: [
    "{name} raised a complaint about a recurring late-fee charge despite on-time payment. Agent created ticket {ticket} for resolution within 48 hours.",
    "Customer ({name}) reported a duplicate EMI debit. Agent escalated for billing review; SLA of 48 hours communicated.",
  ],
  not_eligible: [
    "{name}'s eligibility check flagged a manual review based on the latest profile. Agent committed to a 3-day follow-up after underwriter review.",
    "Customer ({name}) didn't meet automated eligibility this round. Manual-review request raised on the account.",
  ],
  requesting_branch_visit: [
    "{name} preferred an in-branch experience over a phone-led flow. Branch address and timings shared via SMS; customer plans to visit this week.",
    "Customer ({name}) was uncomfortable completing the process online. Agent suggested the nearest branch and SMS'd the address.",
  ],
  wrong_number: [
    "Reached the wrong recipient; the number is no longer associated with the customer. Contact removed from the active list.",
    "{name} confirmed they have no loan with Volt Money. Agent apologised and updated the suppression list.",
  ],
  dnd_requested: [
    "{name} explicitly requested DND. Number marked as DND across all outreach channels.",
    "Customer ({name}) asked to stop all calls. DND added to the account; further outreach blocked.",
  ],
  transferred_to_human: [
    "Customer ({name}) preferred to speak with a human agent. Call cleanly handed off to the customer success queue.",
    "{name} requested live agent assistance for a sensitive concern. Transferred to a senior team member.",
  ],
  customer_unavailable: [
    "{name} couldn't take the call right now and the conversation didn't progress. Agent will retry per campaign retry policy.",
    "Customer ({name}) stepped into a meeting. Call ended without engagement; flagged for retry.",
  ],
};

/*
 * Free-form key/value structured outputs the AI would extract per call.
 * The set of keys is dynamic and contextual — campaign type + outcome
 * shape what gets pulled. The UI humanizes the keys at render time
 * (snake_case → "Title case"), so all that matters here is producing
 * realistic slot names and short string values.
 */
function makeCustomIntents(campaignName, intent, sentiment, durationSec) {
  const lower = campaignName.toLowerCase();
  const out = {};

  // Universal — every answered call gets one of these
  out.social_media_mention = rnd() < 0.18
    ? pick(['Yes - Twitter complaint', 'Yes - WhatsApp group', 'Yes - Instagram review'])
    : 'No';

  // Drop-off only makes sense on a short or abandoned-ish call
  if (durationSec > 0 && durationSec < 30) {
    out.drop_off_reason = pick([
      'Customer hung up',
      'Network drop',
      'Asked to call back',
      'Not stated',
    ]);
  }

  // Campaign-specific extractions
  if (lower.includes('emi') || lower.includes('recovery') || lower.includes('npa') || lower.includes('restructure')) {
    if (intent !== 'payment_promised' && intent !== 'payment_already_done') {
      out.payment_blocker = pick([
        'Cash flow issue',
        'Bank account closed',
        'Disputed amount',
        'Awaiting salary credit',
        'Not stated',
      ]);
    }
    if (rnd() < 0.35) {
      out.competitor_mentioned = pick(['No', 'Yes - HDFC', 'Yes - SBI', 'Yes - Axis']);
    }
    if (rnd() < 0.4) {
      out.callback_preference = pick([
        'Tomorrow morning',
        'After 6 PM',
        'This weekend',
        'Not stated',
      ]);
    }
  } else if (lower.includes('kyc')) {
    if (intent !== 'kyc_completed_on_call') {
      out.kyc_blocker = pick([
        'Document not available',
        'Video KYC tech issue',
        'Customer hesitant',
        'Phone not supported',
        'Not stated',
      ]);
    }
    out.preferred_kyc_channel = pick(['Branch visit', 'Video KYC', 'App self-service']);
  } else if (lower.includes('cross-sell') || lower.includes('top-up') || lower.includes('renewal') || lower.includes('festival')) {
    out.urgency = sentiment === 'positive' ? 'High' : sentiment === 'neutral' ? 'Medium' : 'Low';
    if (rnd() < 0.4) {
      out.decision_maker = pick(['Self', 'Spouse', 'Father', 'Family group']);
    }
    if (rnd() < 0.35) {
      out.competitor_mentioned = pick(['No', 'Yes - HDFC', 'Yes - SBI', 'Yes - Axis']);
    }
  } else if (lower.includes('welcome') || lower.includes('document')) {
    out.preferred_communication = pick(['WhatsApp', 'SMS', 'Phone call', 'Email']);
    if (rnd() < 0.3) {
      out.english_proficiency = pick(['Fluent', 'Basic', 'Hindi preferred']);
    }
  }

  // Outcome-specific extractions
  if (intent === 'complaint_raised') {
    out.complaint_topic = pick([
      'App not working',
      'Wrong charge',
      'Agent rude',
      'Disbursal delay',
      'KYC delay',
    ]);
  }

  if (intent === 'call_me_later' && !out.callback_preference) {
    out.callback_preference = pick([
      'Tomorrow morning',
      'After 6 PM',
      'This weekend',
      'Not stated',
    ]);
  }

  return out;
}

function buildSummary(intent, name, amountFmt, dueDate) {
  const templates = SUMMARY_TEMPLATES[intent];
  if (!templates || templates.length === 0) {
    return `Customer ${name} engaged with the agent and the call ended cleanly.`;
  }
  const tpl = templates[Math.floor(rnd() * templates.length)];
  return tpl
    .replace(/\{name\}/g, name)
    .replace(/\{amount\}/g, amountFmt)
    .replace(/\{due\}/g, dueDate)
    .replace(/\{ticket\}/g, `TKT-${randInt(40000, 49999)}`);
}

/*
 * In-progress call — the dialer is connected and the agent is talking
 * to the customer right now. No transcript / insights / duration yet
 * (they're populated when the call ends). Lives only on running
 * campaigns, with an `initiatedAt` in the last few minutes.
 */
function makeInProgressCall(campaign, agent, idx) {
  const id = `call_${campaign.id}_inp_${String(idx).padStart(5, '0')}`;
  const phone = indianPhone();
  const fullName = customerName();
  const minutesAgo = randInt(0, 12);
  const initiatedAt = new Date(NOW - minutesAgo * 60_000).toISOString();
  return {
    id,
    workspaceId: 'ws_volt',
    campaignId: campaign.id,
    voiceAgentId: agent.id,
    phoneNumber: phone,
    customerName: fullName,
    contactAttributes: {
      customer_name: fullName,
      loan_amount: String(moneyAmount()),
      due_date: dueDate(),
    },
    initiatedAt,
    connectedAt: initiatedAt,
    answeredAt: initiatedAt,
    duration: 0,
    status: 'in_progress',
    reviewed: false,
    flagged: false,
    tags: [],
    cost: 0,
  };
}

function makeCall(campaign, agent, idx, dayOffset) {
  const id = `call_${campaign.id}_${String(idx).padStart(5, '0')}`;
  const phone = indianPhone();
  const fullName = customerName();
  const firstName = fullName.split(' ')[0];

  const baseTime = new Date(NOW - dayOffset * ONE_DAY);
  baseTime.setUTCHours(randInt(4, 13), randInt(0, 59), randInt(0, 59), 0); // 9:30am–7:30pm IST
  const initiatedAt = baseTime.toISOString();

  const status = weighted([
    ['answered', 70],
    ['failed', 20],
    ['abandoned', 6],
    ['completed', 4], // connected but didn't reach answered fully
  ]);

  const cost = Math.round((1.4 + rnd() * 1.6) * 100) / 100;
  const tags = [];

  if (status === 'failed') {
    const reason = weighted(FAILURE_REASONS);
    return {
      id,
      workspaceId: 'ws_volt',
      campaignId: campaign.id,
      voiceAgentId: agent.id,
      phoneNumber: phone,
      customerName: fullName,
      contactAttributes: {
        customer_name: fullName,
        loan_amount: String(moneyAmount()),
        due_date: dueDate(),
      },
      initiatedAt,
      duration: 0,
      status: 'failed',
      failureReason: reason,
      reviewed: false,
      flagged: false,
      tags,
      cost: 0.4,
    };
  }

  if (status === 'abandoned') {
    const ringMs = randInt(8_000, 22_000);
    const endedAt = new Date(baseTime.getTime() + ringMs).toISOString();
    return {
      id,
      workspaceId: 'ws_volt',
      campaignId: campaign.id,
      voiceAgentId: agent.id,
      phoneNumber: phone,
      customerName: fullName,
      contactAttributes: {
        customer_name: fullName,
        loan_amount: String(moneyAmount()),
        due_date: dueDate(),
      },
      initiatedAt,
      connectedAt: initiatedAt,
      endedAt,
      duration: Math.round(ringMs / 1000),
      status: 'abandoned',
      reviewed: false,
      flagged: false,
      tags,
      cost: 0.6,
    };
  }

  // answered (or 'completed' connected, treat similarly)
  const intent = pick(INTENTS);
  const attrs = {
    customer_name: fullName,
    loan_amount: String(moneyAmount()),
    due_date: dueDate(),
  };
  const insightsAttrs = {
    amount: formatINR(parseInt(attrs.loan_amount, 10)),
    due: attrs.due_date,
  };

  const transcript = transcriptFor(intent, agent.name, { firstName }, insightsAttrs);
  // entitiesFromAttrs needs the insights-shaped attrs (amount, due), not the
  // raw contact attrs.
  const _entities = entitiesFromAttrs(insightsAttrs, intent, transcript);
  const ringMs = randInt(2_000, 6_000);
  const totalMs = transcript[transcript.length - 1].endMs + ringMs + 800;
  const connectedAt = new Date(baseTime.getTime() + ringMs).toISOString();
  const answeredAt = new Date(baseTime.getTime() + ringMs + 600).toISOString();
  const endedAt = new Date(baseTime.getTime() + totalMs).toISOString();
  const duration = Math.round((totalMs - 600) / 1000);

  const sentiment = weighted([
    ['positive', 45],
    ['neutral', 35],
    ['negative', 20],
  ]);
  const sentimentScore =
    sentiment === 'positive' ? 0.4 + rnd() * 0.5 :
    sentiment === 'neutral'  ? -0.15 + rnd() * 0.3 :
                                -0.85 + rnd() * 0.4;

  const sentimentByTurn = transcript.map((_, i) => {
    const drift = (rnd() - 0.5) * 0.4;
    return Math.max(-1, Math.min(1, sentimentScore + drift - i * 0.02));
  });

  const secondaryIntents = pickN(
    INTENTS.filter((x) => x !== intent),
    randInt(0, 2),
  );

  const outcome = pick(OUTCOMES_BY_INTENT[intent] ?? ['no_resolution']);
  const summary = buildSummary(intent, fullName, insightsAttrs.amount, insightsAttrs.due);

  return {
    id,
    workspaceId: 'ws_volt',
    campaignId: campaign.id,
    voiceAgentId: agent.id,
    phoneNumber: phone,
    customerName: fullName,
    contactAttributes: attrs,
    initiatedAt,
    connectedAt,
    answeredAt,
    endedAt,
    duration,
    status: 'answered',
    recording: {
      url: '/mocks/sample-call.mp3',
      durationMs: totalMs - 600,
      fileSizeBytes: Math.round((totalMs - 600) * 16),
    },
    transcript,
    insights: {
      primaryIntent: intent,
      secondaryIntents,
      sentiment,
      sentimentScore: Math.round(sentimentScore * 100) / 100,
      sentimentByTurn: sentimentByTurn.map((v) => Math.round(v * 100) / 100),
      entities: _entities,
      summary,
      outcome,
      toolCalls: toolCallsFor(intent, transcript),
      customIntents: makeCustomIntents(campaign.name, intent, sentiment, duration),
    },
    reviewed: rnd() < 0.12,
    flagged: rnd() < 0.04,
    notes: rnd() < 0.08
      ? pick([
          'Customer agreed to pay by 15th. Set follow-up for 16th.',
          'Escalate to human agent — recurring complaint.',
          'Good lead for top-up. Pass to sales.',
          'Confirmed wrong number. Suppress this contact.',
        ])
      : undefined,
    tags: rnd() < 0.2 ? pickN(['follow-up', 'escalate', 'paid', 'lead', 'do-not-call'], randInt(1, 2)) : [],
    cost,
  };
}

// ────────────────────────────────────────────────────────────────────
// Generate calls per campaign, distributing by status
// ────────────────────────────────────────────────────────────────────
const calls = [];
const agentById = Object.fromEntries(voiceAgents.map((a) => [a.id, a]));

for (const c of campaigns) {
  if (c._kind === 'draft' || c._kind === 'scheduled') continue;
  const target = c.metrics.callsInitiated;
  if (target === 0) continue;
  const agent = agentById[c.voiceAgentId];

  const isCompleted = c._kind === 'completed';
  // For completed, calls are spread across the campaign window.
  // For active, calls in the last 1–14 days, biased toward today.
  const completedStart = isCompleted ? Math.floor((NOW - new Date(c.startedAt).getTime()) / ONE_DAY) : null;
  const completedEnd = isCompleted ? Math.floor((NOW - new Date(c.completedAt).getTime()) / ONE_DAY) : null;
  const activeStart = !isCompleted ? Math.floor((NOW - new Date(c.startedAt).getTime()) / ONE_DAY) : null;

  for (let i = 0; i < target; i++) {
    const dayOffset = isCompleted
      ? randInt(completedEnd, completedStart)
      : (rnd() < 0.35 ? 0 : randInt(0, Math.max(1, activeStart)));
    calls.push(makeCall(c, agent, i + 1, dayOffset));
  }

  // Sprinkle a handful of in-progress calls onto currently-running
  // campaigns so the demo has live activity to display.
  if (c._kind === 'running') {
    const liveCount = randInt(2, 6);
    for (let i = 0; i < liveCount; i++) {
      calls.push(makeInProgressCall(c, agent, target + i + 1));
    }
  }
}

// Sort by initiatedAt desc — most recent first
calls.sort((a, b) => (a.initiatedAt < b.initiatedAt ? 1 : -1));

// ────────────────────────────────────────────────────────────────────
// Re-derive campaign metrics from generated calls (accuracy)
// In-progress calls don't count toward initiated/connected metrics.
// ────────────────────────────────────────────────────────────────────
for (const c of campaigns) {
  if (c._kind === 'draft' || c._kind === 'scheduled') continue;
  // Exclude in_progress calls from settled metrics — they're still mid-flight.
  const myCalls = calls.filter((x) => x.campaignId === c.id && x.status !== 'in_progress');
  if (myCalls.length === 0) continue;
  const initiated = myCalls.length;
  const failed = myCalls.filter((x) => x.status === 'failed').length;
  const connected = initiated - failed;
  const answered = myCalls.filter((x) => x.status === 'answered').length;
  const totalDur = myCalls.reduce((s, x) => s + (x.duration || 0), 0);
  const totalCost = myCalls.reduce((s, x) => s + (x.cost || 0), 0);
  const ansCount = myCalls.filter((x) => x.duration > 0).length;
  c.metrics = {
    baseUploaded: c.metrics.baseUploaded,
    callsInitiated: initiated,
    callsConnected: connected,
    callsAnswered: answered,
    callsFailed: failed,
    avgCallDuration: ansCount ? Math.round(totalDur / ansCount) : 0,
    totalCost: Math.round(totalCost * 100) / 100,
  };
}

// Drop the internal-only `_kind` field before serialisation.
for (const c of campaigns) delete c._kind;

// ────────────────────────────────────────────────────────────────────
// Write outputs
// ────────────────────────────────────────────────────────────────────
function write(name, data) {
  const path = join(OUT_DIR, name);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  const bytes = JSON.stringify(data).length;
  console.log(`  ${name.padEnd(20)} ${String(Array.isArray(data) ? data.length : 1).padStart(6)} records  ${(bytes / 1024 / 1024).toFixed(2)} MB`);
}

/*
 * Split calls into:
 *   calls.json        — summary fields used by tables, charts, KPIs
 *                       (no transcript / insights / contactAttributes)
 *   call-details.json — keyed map { [id]: { transcript, insights, recording,
 *                       contactAttributes, notes } } loaded on drawer open
 *
 * This split mirrors the implied backend contract:
 *   GET /calls?...        → CallSummary[]
 *   GET /calls/:id/detail → CallDetail
 */
const callSummaries = calls.map((c) => ({
  id: c.id,
  workspaceId: c.workspaceId,
  campaignId: c.campaignId,
  voiceAgentId: c.voiceAgentId,
  phoneNumber: c.phoneNumber,
  customerName: c.customerName,
  initiatedAt: c.initiatedAt,
  connectedAt: c.connectedAt,
  answeredAt: c.answeredAt,
  endedAt: c.endedAt,
  duration: c.duration,
  status: c.status,
  failureReason: c.failureReason,
  primaryIntent: c.insights?.primaryIntent,
  sentiment: c.insights?.sentiment,
  hasRecording: Boolean(c.recording),
  reviewed: c.reviewed,
  flagged: c.flagged,
  tags: c.tags,
  cost: c.cost,
}));

const callDetails = Object.fromEntries(
  calls
    .filter((c) => c.transcript || c.insights || c.recording || c.notes)
    .map((c) => [
      c.id,
      {
        id: c.id,
        contactAttributes: c.contactAttributes,
        recording: c.recording,
        transcript: c.transcript,
        insights: c.insights,
        notes: c.notes,
      },
    ]),
);

console.log('Generating Volt Voice mock data...');
write('workspaces.json', [workspace]);
write('users.json', [user]);
write('voice-agents.json', voiceAgents);
write('campaigns.json', campaigns);
write('calls.json', callSummaries);
write('call-details.json', callDetails);

console.log(`\nDone. ${calls.length} calls across ${campaigns.length} campaigns.`);
console.log(`  answered: ${calls.filter(c => c.status === 'answered').length}`);
console.log(`  failed:   ${calls.filter(c => c.status === 'failed').length}`);
console.log(`  abandoned:${calls.filter(c => c.status === 'abandoned').length}`);
console.log(`  completed:${calls.filter(c => c.status === 'completed').length}`);
