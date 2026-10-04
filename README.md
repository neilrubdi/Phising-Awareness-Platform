# Aware Trust — NHS-style Phishing Simulation & Awareness Platform

> This project is a cybersecurity-awareness simulation using fictional users and synthetic data. It does not send real phishing emails, collect credentials, interact with real NHS systems, or target real users.

## Purpose & objectives
Run safe, simulated phishing-awareness campaigns in a fictional NHS-style organisation, measure how users respond, deliver training, and visualise human cyber-risk.

## Architecture
- **Frontend:** React 19, TypeScript, TanStack Start (Vite), Tailwind CSS v4, shadcn/ui, Recharts, Zod.
- **Database:** Lovable Cloud (managed PostgreSQL). Schema and seed data live in the migration under `drizzle/migrations/`.
- **Analytics:** risk, campaign and department metrics are calculated from stored interactions in `src/lib/analytics.ts`.
- **PDF export:** jsPDF + autotable, client-side.

## Data model
`departments`, `staff_users`, `campaigns`, `simulation_messages`, `user_interactions` (delivered / opened / clicked / reported), `training_modules`, `training_attempts`, `reports`, `audit_logs` (append-only). Risk scores are derived live rather than stored, so they always match the underlying data.

## Demo mode
Seeded with 100 fictional users, 6 departments, 5 campaigns, 20 simulated messages, 6 training modules, ~1,500 interaction records and historical training attempts. Visitors act as "Security Admin".

## Risk methodology
Base 100 · −15 per report · −8 per training module · −5 per message identified (opened, not clicked) · +20 per click · +10 per repeated failure · +10 if no training. Clamped 0–100. Low < 25, Medium < 50, High < 75, Critical ≥ 75.

## Security considerations
- No credential fields, no external links, no email sending.
- Zod validation in forms plus database CHECK constraints (lengths, enums, date order).
- Row-level security enabled on every table; audit logs cannot be updated or deleted.
- Role-ready: access is currently open for the demo; add sign-in plus a roles table before real use.

## Limitations
Open demo access; risk weights are fixed in code; PDF is generated in the browser.

## Future improvements
Admin sign-in with roles, editable risk weights, per-message indicator editor, scheduled campaigns, and LMS integration.
