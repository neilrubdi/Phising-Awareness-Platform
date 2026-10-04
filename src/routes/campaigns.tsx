import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Rocket, Pencil, Trash2, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { ErrorState, Loading, Panel, fmtDate } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { logAudit, useAppData, useRefresh, type Campaign } from "@/lib/data";
import { computeCampaignStats, computeUserRisks, type CampaignStats } from "@/lib/analytics";
import { SCENARIOS } from "@/lib/content";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/campaigns")({
  head: () => pageHead("Campaigns", "Create, launch and review simulated phishing-awareness campaigns."),
  component: CampaignsPage,
});

const schema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters").max(150),
  description: z.string().trim().max(1000),
  scenario: z.string().min(1, "Choose a scenario"),
  target_department_id: z.string().nullable(),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
  start_date: z.string().min(1, "Start date required"),
  end_date: z.string().min(1, "End date required"),
  status: z.enum(["Draft", "Active", "Completed"]),
}).refine((v) => v.end_date >= v.start_date, { message: "End date must be on or after start date", path: ["end_date"] });

type FormState = z.input<typeof schema>;
const today = () => new Date().toISOString().slice(0, 10);
const empty = (): FormState => ({ name: "", description: "", scenario: SCENARIOS[0]!.name, target_department_id: null, difficulty: "Beginner", start_date: today(), end_date: today(), status: "Draft" });

function CampaignsPage() {
  const { data, isLoading, error } = useAppData();
  const refresh = useRefresh();
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty());
  const [errs, setErrs] = useState<Partial<Record<keyof FormState, string>>>({});
  const [results, setResults] = useState<CampaignStats | null>(null);
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => (data ? computeCampaignStats(data) : []), [data]);
  const risks = useMemo(() => (data ? computeUserRisks(data) : []), [data]);

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} />;

  const deptName = (id: string | null) => (id ? data.departments.find((d) => d.id === id)?.name ?? "—" : "All departments");
  const msgCount = (cid: string) => data.messages.filter((m) => m.campaign_id === cid).length;

  const openNew = () => { setEditing(null); setForm(empty()); setErrs({}); setOpen(true); };
  const openEdit = (c: Campaign) => {
    setEditing(c);
    setForm({ name: c.name, description: c.description, scenario: c.scenario, target_department_id: c.target_department_id, difficulty: c.difficulty as FormState["difficulty"], start_date: c.start_date, end_date: c.end_date, status: c.status as FormState["status"] });
    setErrs({}); setOpen(true);
  };

  const save = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setErrs(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0] as string, i.message])));
      return;
    }
    setBusy(true);
    const payload = parsed.data;
    const res = editing
      ? await supabase.from("campaigns").update(payload).eq("id", editing.id)
      : await supabase.from("campaigns").insert(payload);
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return; }
    await logAudit(editing ? "Campaign updated" : "Campaign created", payload.name, `Difficulty: ${payload.difficulty}, target: ${deptName(payload.target_department_id)}`);
    toast.success(editing ? "Campaign updated" : "Campaign created");
    setOpen(false); refresh();
  };

  const remove = async (c: Campaign) => {
    if (!confirm(`Delete campaign "${c.name}" and its simulation records?`)) return;
    const { error } = await supabase.from("campaigns").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    await logAudit("Campaign deleted", c.name);
    toast.success("Campaign deleted"); refresh();
  };

  const launch = async (c: Campaign) => {
    const tpl = SCENARIOS.find((s) => s.name === c.scenario) ?? SCENARIOS[0]!;
    const { data: msgs, error: e1 } = await supabase.from("simulation_messages")
      .insert(tpl.messages.map((m) => ({ ...m, campaign_id: c.id })))
      .select("id");
    if (e1 || !msgs) { toast.error(e1?.message ?? "Failed"); return; }
    const targets = data.users.filter((u) => !c.target_department_id || u.department_id === c.target_department_id);
    const rows = targets.map((u, i) => ({ user_id: u.id, message_id: msgs[i % msgs.length]!.id, action: "delivered" }));
    const { error: e2 } = await supabase.from("user_interactions").insert(rows);
    if (e2) { toast.error(e2.message); return; }
    await supabase.from("campaigns").update({ status: "Active" }).eq("id", c.id);
    await logAudit("Simulation launched", c.name, `${msgs.length} simulated messages delivered in-app to ${targets.length} fictional users`);
    toast.success(`Launched to ${targets.length} in-app inboxes`); refresh();
  };

  const riskReduction = (s: CampaignStats) => {
    const ids = new Set(data.interactions.filter((i) => data.messages.find((m) => m.id === i.message_id)?.campaign_id === s.campaign.id).map((i) => i.user_id));
    const rs = risks.filter((r) => ids.has(r.user.id));
    return rs.length ? Math.round(rs.reduce((a, r) => a + (100 - r.score), 0) / rs.length) : 0;
  };

  return (
    <div>
      <PageHeader title="Campaigns" description="All messages stay inside this application." actions={<Button onClick={openNew}><Plus className="mr-1 h-4 w-4" />New campaign</Button>} />
      <Panel>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Campaign</TableHead><TableHead>Target</TableHead><TableHead>Difficulty</TableHead><TableHead>Dates</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Click / Report</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {stats.map((s) => {
              const c = s.campaign;
              return (
                <TableRow key={c.id}>
                  <TableCell><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.scenario} · {msgCount(c.id)} messages</div></TableCell>
                  <TableCell>{deptName(c.target_department_id)}</TableCell>
                  <TableCell><Badge variant="outline">{c.difficulty}</Badge></TableCell>
                  <TableCell className="text-xs">{fmtDate(c.start_date)} – {fmtDate(c.end_date)}</TableCell>
                  <TableCell><Badge variant={c.status === "Active" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                  <TableCell className="stat-num text-right">{s.clickRate}% / {s.reportRate}%</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setResults(s)} aria-label="Results"><BarChart3 className="h-4 w-4" /></Button>
                      {msgCount(c.id) === 0 && <Button size="sm" variant="outline" onClick={() => launch(c)}><Rocket className="mr-1 h-3 w-3" />Launch</Button>}
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(c)} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit campaign" : "New simulated campaign"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Field label="Campaign name" err={errs.name}><Input value={form.name} maxLength={150} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Description" err={errs.description}><Textarea value={form.description} maxLength={1000} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Scenario" err={errs.scenario}>
                <Select value={form.scenario} onValueChange={(v) => setForm({ ...form, scenario: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SCENARIOS.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Target department">
                <Select value={form.target_department_id ?? "all"} onValueChange={(v) => setForm({ ...form, target_department_id: v === "all" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All departments</SelectItem>{data.departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Difficulty">
                <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v as FormState["difficulty"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["Beginner", "Intermediate", "Advanced"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as FormState["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["Draft", "Active", "Completed"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Start date" err={errs.start_date}><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
              <Field label="End date" err={errs.end_date}><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={busy}>{editing ? "Save changes" : "Create campaign"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!results} onOpenChange={(o) => !o && setResults(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{results?.campaign.name} — results</DialogTitle></DialogHeader>
          {results && (
            <div className="grid grid-cols-3 gap-3 text-sm">
              {[
                ["Users targeted", results.targeted], ["Delivered", results.delivered], ["Opened", results.opened],
                ["Simulated clicks", results.clicked], ["Reports", results.reported], ["Click rate", `${results.clickRate}%`],
                ["Report rate", `${results.reportRate}%`], ["Training completion", `${results.trainingCompletion}%`], ["Risk reduction", `${riskReduction(results)}%`],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-md border p-3"><div className="text-xs text-muted-foreground">{k}</div><div className="stat-num text-xl font-semibold">{v}</div></div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, err, children }: { label: string; err?: string | undefined; children: ReactNode }) {
  return <div className="grid gap-1.5"><Label>{label}</Label>{children}{err && <p className="text-xs text-destructive">{err}</p>}</div>;
}
