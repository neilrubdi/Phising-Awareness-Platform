export const INDICATORS = [
  "Suspicious sender",
  "Urgent language",
  "Unexpected request",
  "Unusual link",
  "Request for sensitive information",
  "Grammar/spelling issues",
  "Threatening language",
] as const;

export const INDICATOR_HELP: Record<string, string> = {
  "Suspicious sender": "The sender's address uses an external or look-alike domain rather than an official organisational domain.",
  "Urgent language": "The message pressures you to act immediately so you don't stop to think.",
  "Unexpected request": "You weren't expecting this message or the action it asks for.",
  "Unusual link": "The link text hides where it really goes, or points to an unfamiliar site.",
  "Request for sensitive information": "Legitimate teams never ask you to confirm passwords, bank or identity details by message.",
  "Grammar/spelling issues": "Spelling mistakes and odd phrasing are common in phishing messages.",
  "Threatening language": "Threats of suspension, penalties or lockout are used to scare you into acting.",
};

export interface ScenarioTemplate {
  name: string;
  messages: { sender_name: string; sender_address: string; subject: string; body: string; link_text: string; indicators: string[] }[];
}

export const SCENARIOS: ScenarioTemplate[] = [
  { name: "Password expiry", messages: [
    { sender_name: "IT Service Desk", sender_address: "it-desk@trust-passw0rd.example", subject: "Your password expires in 1 hour", body: "Your password will expire shortly. Click below now to avoid losing acess.", link_text: "Keep my password", indicators: ["Suspicious sender", "Urgent language", "Grammar/spelling issues", "Unusual link"] },
    { sender_name: "Account Admin", sender_address: "admin@accounts-update.example", subject: "Mandatory password reset", body: "Reset your password before end of shift or your account will be suspended.", link_text: "Reset now", indicators: ["Threatening language", "Urgent language"] },
  ]},
  { name: "IT helpdesk", messages: [
    { sender_name: "Helpdesk", sender_address: "helpdesk@itsupport-trust.example", subject: "Ticket requires your action", body: "A request to delete your mailbox was received. Cancel it here if this wasn't you.", link_text: "Cancel request", indicators: ["Unexpected request", "Urgent language"] },
    { sender_name: "Service Desk", sender_address: "desk@servicedesk.example", subject: "Your mailbox is full", body: "Upgrade storage now to keep recieving email.", link_text: "Upgrade storage", indicators: ["Grammar/spelling issues", "Unusual link"] },
  ]},
  { name: "Security alert", messages: [
    { sender_name: "Security Team", sender_address: "alerts@secure-login.example", subject: "Unusual sign-in detected", body: "Secure your account now or it will be disabled.", link_text: "Secure account", indicators: ["Threatening language", "Urgent language", "Unusual link"] },
    { sender_name: "MFA Service", sender_address: "mfa@auth-verify.example", subject: "MFA re-enrolment required", body: "Re-enrol within 1 hour to keep access.", link_text: "Re-enrol", indicators: ["Urgent language", "Suspicious sender"] },
  ]},
  { name: "Document share", messages: [
    { sender_name: "Dr. K. Mercer", sender_address: "k.mercer@share-docs.example", subject: "Shared: Rota_Changes.xlsx", body: "A colleague shared a document with you.", link_text: "Open document", indicators: ["Suspicious sender", "Unusual link"] },
    { sender_name: "Finance", sender_address: "invoices@finance-share.example", subject: "Invoice overdue", body: "Pay today to avoid penalties.", link_text: "View invoice", indicators: ["Threatening language", "Unexpected request"] },
  ]},
  { name: "Account verification", messages: [
    { sender_name: "Staff Accounts", sender_address: "verify@staff-accounts.example", subject: "Verify your account within 24 hours", body: "Verify your employee details to avoid deactivation.", link_text: "Verify account", indicators: ["Request for sensitive information", "Threatening language"] },
    { sender_name: "Pension Scheme", sender_address: "pensions@pension-update.example", subject: "Update your bank details", body: "Confirm your bank details to keep receiving contributions.", link_text: "Update details", indicators: ["Request for sensitive information", "Suspicious sender"] },
  ]},
];

export interface QuizQ { q: string; options: string[]; answer: number }
export interface Lesson { explanation: string[]; examples: string[]; quiz: QuizQ[] }

const verifyQ: QuizQ = {
  q: "You receive an unexpected message asking you to verify your account urgently. What should you do?",
  options: ["Click immediately", "Reply with your password", "Verify the sender independently and report if suspicious", "Forward it to colleagues"],
  answer: 2,
};

export const LESSONS: Record<string, Lesson> = {
  "identify-phishing": {
    explanation: ["Phishing messages impersonate trusted people or teams to trick you into clicking, opening or sharing.", "Look for a combination of warning signs rather than relying on one."],
    examples: ["'Your password expires TODAY' from it-desk@trust-passw0rd.example", "A parcel notice you weren't expecting with a shortened link"],
    quiz: [verifyQ, { q: "Which is the strongest sign a message is phishing?", options: ["It has a logo", "It asks for your password", "It was sent in the morning", "It is short"], answer: 1 }],
  },
  "suspicious-links": {
    explanation: ["Link text can say anything; the real destination may be different.", "Hover (or long-press) to preview the address and check the domain carefully."],
    examples: ["'nhs.uk.account-check.example' — the real domain is account-check.example", "Shortened links that hide the destination"],
    quiz: [{ q: "In 'portal.nhs.uk.secure-login.example', what is the real domain?", options: ["nhs.uk", "portal.nhs.uk", "secure-login.example", "uk"], answer: 2 }, { q: "Before clicking a link you should…", options: ["Click quickly", "Preview the destination", "Forward it", "Reply asking"], answer: 1 }],
  },
  "sender-verification": {
    explanation: ["Display names are easy to fake. Always check the full sender address.", "If unsure, contact the person using details you already know — not those in the message."],
    examples: ["'IT Service Desk' <helpdesk@itsupport-trust.example>", "A manager's name from a personal webmail account"],
    quiz: [{ q: "How should you verify an unexpected request from your manager?", options: ["Reply to the message", "Call them on a known number", "Click the link to check", "Ignore it forever"], answer: 1 }, verifyQ],
  },
  "urgency-social-engineering": {
    explanation: ["Attackers create pressure — deadlines, threats, authority — so you act before thinking.", "Urgency is a cue to slow down."],
    examples: ["'Act within 1 hour or lose access'", "'The Chief Executive needs gift cards now'"],
    quiz: [{ q: "A message threatens suspension unless you act in 30 minutes. This is…", options: ["Normal policy", "A pressure tactic", "A system test you must pass", "Always genuine"], answer: 1 }, verifyQ],
  },
  reporting: {
    explanation: ["Reporting quickly protects colleagues — one report can stop a whole campaign.", "Use the 'Report Phishing' button. Don't forward suspicious messages to colleagues."],
    examples: ["Clicked by mistake? Report it immediately — no blame.", "Unsure? Report it anyway."],
    quiz: [{ q: "You clicked a suspicious link by mistake. What now?", options: ["Hide it", "Report it immediately", "Delete the message only", "Wait and see"], answer: 1 }, { q: "Best way to warn colleagues about a phishing message?", options: ["Forward it to everyone", "Report it to the security team", "Post the link in chat", "Do nothing"], answer: 1 }],
  },
  "protecting-information": {
    explanation: ["Never share passwords, smartcard PINs or patient data by message.", "Legitimate teams will never ask for your password."],
    examples: ["'Confirm your bank details for pension contributions'", "'Reply with your login to restore access'"],
    quiz: [{ q: "Who may legitimately ask for your password?", options: ["IT support", "Your manager", "No one", "Payroll"], answer: 2 }, verifyQ],
  },
};

export const DISCLAIMER =
  "This project is a cybersecurity-awareness simulation using fictional users and synthetic data. It does not send real phishing emails, collect credentials, interact with real NHS systems, or target real users.";
