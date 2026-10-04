import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard, Megaphone, Inbox, Users, Building2, ShieldAlert, GraduationCap, FileText, ScrollText, Settings, ShieldCheck, Menu,
} from "lucide-react";
import { useState } from "react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/simulations", label: "Simulations", icon: Inbox },
  { to: "/users", label: "Users", icon: Users },
  { to: "/departments", label: "Departments", icon: Building2 },
  { to: "/risk", label: "Risk Analysis", icon: ShieldAlert },
  { to: "/training", label: "Training", icon: GraduationCap },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/audit", label: "Audit Logs", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-5">
          <ShieldCheck className="h-7 w-7 text-sidebar-primary" />
          <div>
            <div className="text-sm font-semibold text-sidebar-accent-foreground">Aware Trust</div>
            <div className="text-xs opacity-70">Phishing Awareness Platform</div>
          </div>
        </div>
        <nav className="space-y-0.5 p-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-sidebar-border p-4 text-xs opacity-70">
          Signed in as <span className="font-medium">Security Admin</span> (demo)
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-foreground/40 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b bg-warning px-4 py-2 text-xs text-warning-foreground">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span><strong>Security-awareness simulation.</strong> Fictional users and synthetic data only — no real emails are sent and no credentials are ever collected.</span>
        </div>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
