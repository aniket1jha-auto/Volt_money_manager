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

const INTENTS = [
  'loan_inquiry',
  'emi_status',
  'repayment_intent',
  'payment_promise',
  'kyc_pending',
  'application_status',
  'callback_request',
  'document_request',
  'balance_inquiry',
  'renewal_inquiry',
  'complaint',
  'dispute_charge',
  'financial_hardship',
  'wrong_number',
  'agent_handoff_request',
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
  loan_inquiry: ['shared_terms', 'requested_callback', 'lost_interest'],
  emi_status: ['provided_status', 'escalated_to_team', 'requested_statement'],
  repayment_intent: ['agreed_to_pay', 'partial_commitment', 'no_resolution'],
  payment_promise: ['agreed_to_pay', 'committed_amount', 'requested_grace_period'],
  kyc_pending: ['kyc_link_shared', 'agreed_to_complete', 'expressed_difficulty'],
  application_status: ['provided_status', 'escalated_to_team'],
  callback_request: ['callback_scheduled'],
  document_request: ['email_sent', 'whatsapp_sent', 'requested_physical'],
  balance_inquiry: ['provided_balance'],
  renewal_inquiry: ['shared_terms', 'requested_callback'],
  complaint: ['ticket_created', 'escalated_to_team', 'resolved_inline'],
  dispute_charge: ['ticket_created', 'escalated_to_team'],
  financial_hardship: ['restructuring_offered', 'grace_period_offered', 'no_resolution'],
  wrong_number: ['contact_removed'],
  agent_handoff_request: ['transferred_to_human'],
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
const CAMPAIGN_TEMPLATES = [
  // active (5)
  { name: 'EMI Reminder — April 2026', agent: 'agent_emi_reminder', status: 'active', base: 2100 },
  { name: 'Loan Recovery — 30 DPD', agent: 'agent_loan_recovery', status: 'active', base: 920 },
  { name: 'Loan Recovery — 60 DPD', agent: 'agent_loan_recovery', status: 'active', base: 460 },
  { name: 'KYC Pending — Personal Loan', agent: 'agent_application_status', status: 'active', base: 670 },
  { name: 'EMI Reminder — Premium Tier', agent: 'agent_emi_reminder', status: 'active', base: 340 },
  // completed (15)
  { name: 'EMI Reminder — March 2026', agent: 'agent_emi_reminder', status: 'completed', base: 2090 },
  { name: 'EMI Reminder — February 2026', agent: 'agent_emi_reminder', status: 'completed', base: 1975 },
  { name: 'Loan Recovery — Q1 2026 Sweep', agent: 'agent_loan_recovery', status: 'completed', base: 1115 },
  { name: 'Application Status — Feb intake', agent: 'agent_application_status', status: 'completed', base: 810 },
  { name: 'KYC Pending — Personal Loan (Jan)', agent: 'agent_application_status', status: 'completed', base: 740 },
  { name: 'KYC Pending — Auto Loan (Feb)', agent: 'agent_application_status', status: 'completed', base: 380 },
  { name: 'Loan Recovery — 90+ DPD Q1', agent: 'agent_loan_recovery', status: 'completed', base: 270 },
  { name: 'Renewal Outreach — Personal Loan', agent: 'agent_application_status', status: 'completed', base: 440 },
  { name: 'Document Reminder — Income Proof', agent: 'agent_application_status', status: 'completed', base: 310 },
  { name: 'EMI Bounce Recovery — March', agent: 'agent_loan_recovery', status: 'completed', base: 560 },
  { name: 'Cross-Sell — Top-up Loans', agent: 'agent_application_status', status: 'completed', base: 725 },
  { name: 'Welcome Calls — New Disbursements (Jan)', agent: 'agent_application_status', status: 'completed', base: 360 },
  { name: 'Welcome Calls — New Disbursements (Feb)', agent: 'agent_application_status', status: 'completed', base: 405 },
  { name: 'Festival Top-up Offer — Holi 2026', agent: 'agent_application_status', status: 'completed', base: 1200 },
  { name: 'NPA Restructure Outreach — Q4 2025', agent: 'agent_loan_recovery', status: 'completed', base: 190 },
  // scheduled (3)
  { name: 'EMI Reminder — May 2026', agent: 'agent_emi_reminder', status: 'scheduled', base: 2155 },
  { name: 'KYC Pending — Q2 sweep', agent: 'agent_application_status', status: 'scheduled', base: 590 },
  { name: 'Cross-Sell — Pre-approved Top-up (May)', agent: 'agent_application_status', status: 'scheduled', base: 1025 },
  // draft (2)
  { name: 'EMI Reminder — Premium Tier (Draft)', agent: 'agent_emi_reminder', status: 'draft', base: 0 },
  { name: 'Recovery — Hardship Cases (Draft)', agent: 'agent_loan_recovery', status: 'draft', base: 0 },
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

function makeMetrics(base, status) {
  if (status === 'draft') {
    return zeroMetrics();
  }
  if (status === 'scheduled') {
    return zeroMetrics(base);
  }
  // For active/completed: simulate funnel.
  const initiatedRate = status === 'completed' ? 1 : 0.45 + rnd() * 0.4;
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

const campaigns = CAMPAIGN_TEMPLATES.map((tpl, i) => {
  const id = `camp_${String(i + 1).padStart(3, '0')}`;
  const status = tpl.status;
  const metrics = makeMetrics(tpl.base, status);
  const contactList = makeContactList(tpl.name, tpl.base);

  let createdAt, startedAt, completedAt, schedule;
  if (status === 'completed') {
    const start = randInt(45, 90);
    createdAt = isoDaysAgo(start + 2);
    startedAt = isoDaysAgo(start);
    completedAt = isoDaysAgo(start - randInt(2, 7));
    schedule = { type: 'immediate', timezone: 'Asia/Kolkata' };
  } else if (status === 'active') {
    const start = randInt(2, 14);
    createdAt = isoDaysAgo(start + 1);
    startedAt = isoDaysAgo(start);
    schedule = { type: 'immediate', timezone: 'Asia/Kolkata' };
  } else if (status === 'scheduled') {
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
    description:
      status === 'draft' ? undefined : `${tpl.name} — outbound voice campaign for ${workspace.name}.`,
    voiceAgentId: tpl.agent,
    status,
    contactList,
    schedule,
    metrics,
    createdBy: 'user_001',
    createdAt,
    startedAt,
    completedAt,
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
    case 'emi_status':
    case 'payment_promise':
    case 'repayment_intent':
      middle.push(
        { text: `I am calling about the EMI of ${attrs.amount} due on ${attrs.due}. Just confirming if you'll be able to pay on time.`, role: 'agent' },
        pick([
          { text: 'Yes, the funds are arranged. I will pay tomorrow itself.', role: 'customer' },
          { text: 'I am facing some issues this month. Can I get a few extra days?', role: 'customer' },
          { text: 'I can pay only half this month. Is that an option?', role: 'customer' },
          { text: 'Already paid yesterday. Please check on your end.', role: 'customer' },
        ]),
        { text: 'Understood. Let me note that for our records. Would you like an SMS reminder a day before?', role: 'agent' },
        pick([
          { text: 'Yes please, an SMS would help.', role: 'customer' },
          { text: 'No need, I have it on my calendar.', role: 'customer' },
          { text: 'Yes and a WhatsApp message too if possible.', role: 'customer' },
        ]),
      );
      break;
    case 'loan_inquiry':
    case 'renewal_inquiry':
      middle.push(
        { text: `I see you have shown interest in our top-up loan offer of ${attrs.amount}. Would you like me to walk you through the terms?`, role: 'agent' },
        pick([
          { text: 'Yes, what is the interest rate? And how long is the tenure?', role: 'customer' },
          { text: 'I am interested but I want to compare with my bank first.', role: 'customer' },
          { text: 'Not right now. Maybe in a couple of months.', role: 'customer' },
        ]),
        { text: 'Of course. Our current rate starts at 11.5% with tenures up to 60 months. I can email the full sheet right after this call.', role: 'agent' },
        pick([
          { text: 'Please email it. I will look at it tonight.', role: 'customer' },
          { text: 'Great, send it across. I might apply by next week.', role: 'customer' },
        ]),
      );
      break;
    case 'kyc_pending':
      middle.push(
        { text: 'Your loan application is approved pending KYC. Could you complete it today using the link we will send?', role: 'agent' },
        pick([
          { text: 'I tried earlier but the link did not work. Please send a fresh one.', role: 'customer' },
          { text: 'Okay, I will do it tonight.', role: 'customer' },
          { text: 'Can someone come home? I am not comfortable with online KYC.', role: 'customer' },
        ]),
        { text: 'Sure, I am sending a new SMS link now. It expires in 24 hours.', role: 'agent' },
      );
      break;
    case 'application_status':
      middle.push(
        { text: 'Calling about your loan application submitted on the 22nd. We have everything except your latest salary slip.', role: 'agent' },
        pick([
          { text: 'I uploaded it yesterday. Can you check again?', role: 'customer' },
          { text: 'Got it, I will share it on WhatsApp now.', role: 'customer' },
          { text: 'Why is this taking so long? It has been three weeks.', role: 'customer' },
        ]),
        { text: 'I will follow up internally and update you by EOD. Thank you for your patience.', role: 'agent' },
      );
      break;
    case 'callback_request':
      middle.push(
        { text: 'I see you requested a callback yesterday. How can I help you today?', role: 'agent' },
        pick([
          { text: 'Yes, I want to know my outstanding amount.', role: 'customer' },
          { text: 'I had asked about prepayment charges.', role: 'customer' },
          { text: 'Actually I missed why I requested it. Let me think.', role: 'customer' },
        ]),
      );
      break;
    case 'document_request':
      middle.push(
        { text: 'We need your latest salary slip and Aadhaar copy to proceed.', role: 'agent' },
        pick([
          { text: 'I can WhatsApp them right now.', role: 'customer' },
          { text: 'Please send the email ID where I should attach them.', role: 'customer' },
        ]),
      );
      break;
    case 'balance_inquiry':
      middle.push(
        { text: `Your outstanding principal is ${attrs.amount} as of today. Anything else?`, role: 'agent' },
        pick([
          { text: 'When is my next EMI due?', role: 'customer' },
          { text: 'Can you email a statement?', role: 'customer' },
        ]),
      );
      break;
    case 'complaint':
    case 'dispute_charge':
      middle.push(
        pick([
          { text: 'I was charged a late fee but I had paid on time!', role: 'customer' },
          { text: 'My EMI got debited twice this month, please refund.', role: 'customer' },
        ]),
        { text: 'I am sorry for the trouble. Let me raise a ticket and have the resolution team contact you in 48 hours.', role: 'agent' },
        pick([
          { text: 'Please make sure it is resolved this time.', role: 'customer' },
          { text: 'Thank you, I will wait.', role: 'customer' },
        ]),
      );
      break;
    case 'financial_hardship':
      middle.push(
        { text: 'I understand you are going through a tough time. We can offer a 30-day grace or restructure the EMI. Which works better?', role: 'agent' },
        pick([
          { text: 'Restructuring would help me a lot. Can you reduce the EMI?', role: 'customer' },
          { text: 'Just the 30-day grace for now, thank you.', role: 'customer' },
        ]),
        { text: 'Noted. I will share the formal restructure proposal by tomorrow.', role: 'agent' },
      );
      break;
    case 'wrong_number':
      middle.push(
        pick([
          { text: 'I think you have the wrong person. I do not have any loan with Volt Money.', role: 'customer' },
          { text: 'Sorry, this number was previously someone else’s.', role: 'customer' },
        ]),
        { text: 'Apologies for the inconvenience. I will remove this number from our list.', role: 'agent' },
      );
      break;
    case 'agent_handoff_request':
      middle.push(
        { text: 'I would prefer to speak to a human agent please.', role: 'customer' },
        { text: 'Of course. I will transfer you to our customer success team right away.', role: 'agent' },
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
  if (['emi_status', 'payment_promise', 'repayment_intent', 'loan_inquiry', 'renewal_inquiry', 'balance_inquiry'].includes(intent)) {
    out.push({
      type: 'amount',
      label: intent === 'balance_inquiry' ? 'Outstanding' : 'Loan amount',
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
  if (intent === 'kyc_pending') {
    out.push({ type: 'reference', label: 'KYC link', value: 'sms-pending', turnIndex: 4 });
  }
  return out;
}

function toolCallsFor(intent, transcript) {
  const out = [];
  if (intent === 'balance_inquiry' || intent === 'emi_status') {
    out.push({
      name: 'lookup_loan_status',
      argsPreview: '{ "customer_id": "cust_abc123" }',
      resultPreview: '{ "principal_outstanding": 245000, "next_emi_date": "2026-05-15" }',
      durationMs: randInt(140, 380),
      status: 'success',
      turnIndex: 2,
    });
  }
  if (intent === 'kyc_pending') {
    out.push({
      name: 'send_kyc_sms',
      argsPreview: '{ "customer_id": "cust_abc123", "channel": "sms" }',
      resultPreview: '{ "delivered": true, "message_id": "msg_xyz" }',
      durationMs: randInt(220, 460),
      status: 'success',
      turnIndex: 4,
    });
  }
  if (intent === 'complaint' || intent === 'dispute_charge') {
    out.push({
      name: 'create_ticket',
      argsPreview: '{ "category": "billing_dispute", "priority": "high" }',
      resultPreview: '{ "ticket_id": "TKT-44219", "sla_hours": 48 }',
      durationMs: randInt(180, 350),
      status: 'success',
      turnIndex: 3,
    });
  }
  return out;
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
      outcome,
      toolCalls: toolCallsFor(intent, transcript),
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
  if (c.status === 'draft' || c.status === 'scheduled') continue;
  const target = c.metrics.callsInitiated;
  if (target === 0) continue;
  const agent = agentById[c.voiceAgentId];

  const isCompleted = c.status === 'completed';
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
}

// Sort by initiatedAt desc — most recent first
calls.sort((a, b) => (a.initiatedAt < b.initiatedAt ? 1 : -1));

// ────────────────────────────────────────────────────────────────────
// Re-derive campaign metrics from generated calls (accuracy)
// ────────────────────────────────────────────────────────────────────
for (const c of campaigns) {
  if (c.status === 'draft' || c.status === 'scheduled') continue;
  const myCalls = calls.filter((x) => x.campaignId === c.id);
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
