import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Panel } from "@/components/common";
import { RISK_WEIGHTS } from "@/lib/analytics";
import { DISCLAIMER, INDICATORS } from "@/lib/content";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/settings")({
  head: () => pageHead("Settings", "Platform configuration, safety guarantees and demo-mode details."),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" />
      <div className="grid max-w-4xl gap-4">
        <Panel title="Safety guarantees">
          <ul className="space-y-2 text-sm">
            {["Fictional users and synthetic data only", "No real emails are ever sent — all messages live in the in-app inbox", "No password or credential fields exist anywhere in simulations", "Simulated links never leave the application", "No connection to real NHS systems, staff or accounts"].map((s) => (
              <li key={s} className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-risk-low" />{s}</li>
            ))}
          </ul>
          <p className="mt-4 rounded-md bg-muted p-3 text-xs text-muted-foreground">{DISCLAIMER}</p>
        </Panel>
        <Panel title="Demo mode">
          <p className="text-sm">Open demo: every visitor acts as <strong>Security Admin</strong>. The data model is role-ready; sign-in can be added later.</p>
        </Panel>
        <Panel title="Risk weights">
          <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">{Object.entries(RISK_WEIGHTS).map(([k, v]) => <div key={k} className="rounded border p-2"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="stat-num font-semibold">{v}</dd></div>)}</dl>
        </Panel>
        <Panel title="Configurable phishing indicators">
          <div className="flex flex-wrap gap-2">{INDICATORS.map((i) => <span key={i} className="rounded-full border px-3 py-1 text-xs">{i}</span>)}</div>
        </Panel>
      </div>
    </div>
  );
}
