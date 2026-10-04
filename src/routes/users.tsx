import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GraduationCap, Search, Eye } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { ErrorState, Loading, Panel, RiskBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { logAudit, useAppData, useRefresh, type StaffUser } from "@/lib/data";
import { computeUserRisks, type UserRisk } from "@/lib/analytics";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/users")({
  head: () => pageHead("Users", "Manage fictional staff users, their risk levels, training status and campaign history."),
  component: UsersPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Name required").max(100),
  role: z.string().trim().min(2, "Role required").max(100),
  department_id: z.string().uuid("Choose a department"),
});

function UsersPage() {
  const { data, isLoading, error } = useAppData();
  const refresh = useRefresh();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [level, setLevel] = useState("all");
  const [edit, setEdit] = useState<StaffUser | "new" | null>(null);
  const [form, setForm] = useState({ name: "", role: "", department_id: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [view, setView] = useState<UserRisk | null>(null);
  const [assign, setAssign] = useState<StaffUser | null>(null);
  const [moduleId, setModuleId] = useState("");

  const risks = useMemo(() => (data ? computeUserRisks(data) : []), [data]);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} />;

  const deptName = (id: string) => data.departments.find((d) => d.id === id)?.name ?? "—";
  const rows = risks.filter((r) =>
    (dept === "all" || r.user.department_id === dept) && (level === "all" || r.level === level) &&
    (!q || `${r.user.name} ${r.user.employee_code} ${r.user.role}`.toLowerCase().includes(q.toLowerCase())));

  const openForm = (u: StaffUser | "new") => {
    setEdit(u); setErrs({});
    setForm(u === "new" ? { name: "", role: "", department_id: data.departments[0]?.id ?? "" } : { name: u.name, role: u.role, department_id: u.department_id });
  };
  const save = async () => {
    const p = schema.safeParse(form);
    if (!p.success) return setErrs(Object.fromEntries(p.error.issues.map((i) => [i.path[0] as string, i.message])));
    let res;
    if (edit === "new") {
      const next = Math.max(0, ...data.users.map((u) => parseInt(u.employee_code.slice(4)) || 0)) + 1;
      res = await supabase.from("staff_users").insert({ ...p.data, employee_code: `EMP-${String(next).padStart(4, "0")}` });
    } else if (edit) res = await supabase.from("staff_users").update(p.data).eq("id", edit.id);
    if (res?.error) return toast.error(res.error.message);
    await logAudit(edit === "new" ? "User created" : "User updated", p.data.name);
    toast.success("Saved"); setEdit(null); refresh();
  };
  const remove = async (u: StaffUser) => {
    if (!confirm(`Delete fictional user ${u.name}?`)) return;
    const { error } = await supabase.from("staff_users").delete().eq("id", u.id);
    if (error) return toast.error(error.message);
    await logAudit("User deleted", u.name); toast.success("Deleted"); refresh();
  };
  const doAssign = async () => {
    if (!assign || !moduleId) return;
    const { error } = await supabase.from("training_attempts").insert({ user_id: assign.id, module_id: moduleId, score: 0, completed: false, status: "assigned" });
    if (error) return toast.error(error.message);
    await logAudit("Training assigned", assign.name, data.modules.find((m) => m.id === moduleId)?.title ?? "");
    toast.success("Training assigned"); setAssign(null); refresh();
  };

  const history = (r: UserRisk) => data.campaigns.map((c) => {
    const mids = new Set(data.messages.filter((m) => m.campaign_id === c.id).map((m) => m.id));
    const acts = new Set(data.interactions.filter((i) => i.user_id === r.user.id && mids.has(i.message_id)).map((i) => i.action));
    return { c, acts };
  }).filter((h) => h.acts.size);

  return (
    <div>
      <PageHeader title="Users" description={`${data.users.length} fictional users`} actions={<Button onClick={() => openForm("new")}><Plus className="mr-1 h-4 w-4" />Add user</Button>} />
      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="w-64 pl-8" placeholder="Search name, ID, role" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select value={dept} onValueChange={setDept}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All departments</SelectItem>{data.departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
          <Select value={level} onValueChange={setLevel}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All risk levels</SelectItem>{["Low", "Medium", "High", "Critical"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead><TableHead>Role</TableHead><TableHead>Risk</TableHead><TableHead>Training</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.user.id}>
                <TableCell className="stat-num text-xs">{r.user.employee_code}</TableCell>
                <TableCell className="font-medium">{r.user.name}</TableCell>
                <TableCell>{deptName(r.user.department_id)}</TableCell>
                <TableCell>{r.user.role}</TableCell>
                <TableCell><RiskBadge level={r.level} score={r.score} /></TableCell>
                <TableCell><Badge variant="outline">{r.trainingStatus}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setView(r)} aria-label="View"><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { setAssign(r.user); setModuleId(data.modules[0]?.id ?? ""); }} aria-label="Assign training"><GraduationCap className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => openForm(r.user)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(r.user)} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit === "new" ? "Add fictional user" : "Edit user"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label>Name (fictional)</Label><Input maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />{errs.name && <p className="text-xs text-destructive">{errs.name}</p>}</div>
            <div className="grid gap-1.5"><Label>Role</Label><Input maxLength={100} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />{errs.role && <p className="text-xs text-destructive">{errs.role}</p>}</div>
            <div className="grid gap-1.5"><Label>Department</Label>
              <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{data.departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assign} onOpenChange={(o) => !o && setAssign(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign training to {assign?.name}</DialogTitle></DialogHeader>
          <Select value={moduleId} onValueChange={setModuleId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{data.modules.map((m) => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}</SelectContent></Select>
          <DialogFooter><Button onClick={doAssign}>Assign</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{view?.user.name} <span className="text-sm font-normal text-muted-foreground">{view?.user.employee_code}</span></DialogTitle></DialogHeader>
          {view && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2"><RiskBadge level={view.level} score={view.score} /><span className="text-muted-foreground">{deptName(view.user.department_id)} · {view.user.role}</span></div>
              <div>
                <h3 className="mb-2 font-semibold">Risk calculation</h3>
                <table className="w-full text-xs"><tbody>
                  {view.breakdown.map((b) => <tr key={b.label} className="border-b"><td className="py-1">{b.label}</td><td className="stat-num py-1 text-right">{b.value > 0 ? `+${b.value}` : b.value}</td></tr>)}
                  <tr className="font-semibold"><td className="py-1">Total (clamped 0–100)</td><td className="stat-num py-1 text-right">{view.raw} → {view.score}</td></tr>
                </tbody></table>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Campaign history</h3>
                <ul className="space-y-1">{history(view).map(({ c, acts }) => (
                  <li key={c.id} className="flex justify-between gap-2 rounded border px-2 py-1 text-xs"><span>{c.name}</span><span className="text-muted-foreground">{["opened", "clicked", "reported"].filter((a) => acts.has(a)).join(", ") || "delivered"}</span></li>
                ))}</ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
