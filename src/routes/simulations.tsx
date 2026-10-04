import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Flag, Mail, MailOpen, ShieldCheck, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { ErrorState, Loading, Panel, fmtDateTime } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logAudit, recordInteraction, useAppData, useRefresh, type SimMessage } from "@/lib/data";
import { INDICATOR_HELP } from "@/lib/content";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/simulations")({
  head: () => pageHead("Simulated Inbox", "Safe in-app inbox for fictional users to experience simulated phishing messages."),
  component: SimulationsPage,
});

function SimulationsPage() {
  const { data, isLoading, error } = useAppData();
  const refresh = useRefresh();
  const [userId, setUserId] = useState<string>("");
  const [selected, setSelected] = useState<SimMessage | null>(null);
  const [caught, setCaught] = useState<SimMessage | null>(null);
  const [reportedMsg, setReportedMsg] = useState<string | null>(null);

  const uid = userId || data?.users[0]?.id || "";
  const user = data?.users.find((u) => u.id === uid);

  const inbox = useMemo(() => {
    if (!data || !uid) return [];
    const delivered = new Set(data.interactions.filter((i) => i.user_id === uid && i.action === "delivered").map((i) => i.message_id));
    return data.messages.filter((m) => delivered.has(m.id)).sort((a, b) => b.sent_at.localeCompare(a.sent_at));
  }, [data, uid]);

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} />;

  const has = (mid: string, action: string) => data.interactions.some((i) => i.user_id === uid && i.message_id === mid && i.action === action);

  const openMsg = async (m: SimMessage) => {
    setSelected(m); setReportedMsg(null);
    if (!has(m.id, "opened")) { await recordInteraction(uid, m.id, "opened"); refresh(); }
  };
  const clickLink = async (m: SimMessage) => {
    if (!has(m.id, "clicked")) {
      await recordInteraction(uid, m.id, "clicked");
      await logAudit("Simulated link clicked", m.subject, `User ${user?.name}`, user?.name ?? "User");
      refresh();
    }
    setCaught(m);
  };
  const report = async (m: SimMessage) => {
    await recordInteraction(uid, m.id, "reported");
    await logAudit("Simulation reported", m.subject, `Reported by ${user?.name} at ${new Date().toISOString()}`, user?.name ?? "User");
    setReportedMsg(m.id);
    toast.success("Thank you. The message has been reported to the security team.");
    refresh();
  };

  return (
    <div>
      <PageHeader title="Simulated Inbox" description="View any fictional user's in-app inbox. Links never leave the application." actions={
        <Select value={uid} onValueChange={(v) => { setUserId(v); setSelected(null); }}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Choose user" /></SelectTrigger>
          <SelectContent>{data.users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} · {u.employee_code}</SelectItem>)}</SelectContent>
        </Select>
      } />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Panel title={`Inbox (${inbox.length})`} className="p-0 [&>div:first-child]:px-5 [&>div:first-child]:pt-5">
          <ul className="max-h-[70vh] divide-y overflow-auto">
            {inbox.length === 0 && <li className="p-5 text-sm text-muted-foreground">No simulated messages.</li>}
            {inbox.map((m) => {
              const opened = has(m.id, "opened");
              return (
                <li key={m.id}>
                  <button onClick={() => openMsg(m)} className={cn("w-full px-5 py-3 text-left hover:bg-muted", selected?.id === m.id && "bg-accent")}>
                    <div className="flex items-center gap-2 text-sm">
                      {opened ? <MailOpen className="h-4 w-4 text-muted-foreground" /> : <Mail className="h-4 w-4 text-primary" />}
                      <span className={cn("truncate", !opened && "font-semibold")}>{m.sender_name}</span>
                      {has(m.id, "reported") && <Flag className="ml-auto h-3 w-3 text-risk-low" />}
                    </div>
                    <div className={cn("truncate text-sm", !opened && "font-medium")}>{m.subject}</div>
                    <div className="text-xs text-muted-foreground">{fmtDateTime(m.sent_at)}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel>
          {!selected ? (
            <div className="flex h-64 flex-col items-center justify-center text-sm text-muted-foreground"><Mail className="mb-2 h-8 w-8" />Select a message to read it.</div>
          ) : (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                <div>
                  <h2 className="text-lg font-semibold">{selected.subject}</h2>
                  <div className="mt-1 text-sm"><span className="font-medium">{selected.sender_name}</span> <span className="text-muted-foreground">&lt;{selected.sender_address}&gt;</span></div>
                  <div className="text-xs text-muted-foreground">To: {user?.name} · {fmtDateTime(selected.sent_at)}</div>
                </div>
                <Button variant="outline" onClick={() => report(selected)} disabled={has(selected.id, "reported")}>
                  <Flag className="mr-1 h-4 w-4" />{has(selected.id, "reported") ? "Reported" : "Report Phishing"}
                </Button>
              </div>
              {reportedMsg === selected.id && (
                <div className="mt-4 flex items-center gap-2 rounded-md border border-risk-low/30 bg-risk-low/10 p-3 text-sm text-risk-low">
                  <ShieldCheck className="h-4 w-4" />Thank you. The message has been reported to the security team.
                </div>
              )}
              <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed">{selected.body}</p>
              <button onClick={() => clickLink(selected)} className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary underline">
                {selected.link_text}<ExternalLink className="h-3 w-3" />
              </button>
              <p className="mt-8 text-xs text-muted-foreground">Simulated message · in-app only · no external link</p>
            </div>
          )}
        </Panel>
      </div>

      <Dialog open={!!caught} onOpenChange={(o) => !o && setCaught(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-risk-high">⚠️ Phishing Simulation</DialogTitle></DialogHeader>
          {caught && (
            <div className="space-y-4 text-sm">
              <p><strong>This was a simulated phishing message.</strong> No information was collected — in a real attack, this link could have stolen your credentials or installed malware.</p>
              <div>
                <h3 className="mb-2 font-semibold">Warning signs present</h3>
                <ul className="space-y-2">
                  {caught.indicators.map((i) => (
                    <li key={i} className="rounded-md border p-2"><div className="font-medium">{i}</div><div className="text-xs text-muted-foreground">{INDICATOR_HELP[i] ?? ""}</div></li>
                  ))}
                  <li className="rounded-md border p-2"><div className="font-medium">Sender address</div><div className="stat-num text-xs text-muted-foreground">{caught.sender_address}</div></li>
                </ul>
              </div>
              <div><h3 className="mb-1 font-semibold">What you should have done</h3><p className="text-muted-foreground">Paused, checked the sender's full address, hovered over the link, and verified the request through a known, independent channel.</p></div>
              <div><h3 className="mb-1 font-semibold">How to report suspicious messages</h3><p className="text-muted-foreground">Use the <strong>Report Phishing</strong> button at the top of the message. Don't forward it to colleagues.</p></div>
              <div className="flex gap-2">
                <Button onClick={() => { const m = caught; setCaught(null); report(m); }}><Flag className="mr-1 h-4 w-4" />Report it now</Button>
                <Button variant="outline" onClick={() => setCaught(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
