import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/AppShell";
import { ErrorState, Loading, Panel, RiskBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { logAudit, useAppData, useRefresh } from "@/lib/data";
import { computeDeptRisks, computeUserRisks } from "@/lib/analytics";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/departments")({
  head: () => pageHead("Departments", "Department-level phishing-awareness risk scores, click and report rates."),
  component: DepartmentsPage,
});

function DepartmentsPage() {
  const { data, isLoading, error } = useAppData();
  const refresh = useRefresh();
  const [filter, setFilter] = useState("all");
  const [name, setName] = useState("");
  const depts = useMemo(() => (data ? computeDeptRisks(data, computeUserRisks(data)) : []), [data]);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} />;

  const add = async () => {
    const p = z.string().trim().min(2).max(60).safeParse(name);
    if (!p.success) return toast.error("Department name must be 2–60 characters");
    const { error } = await supabase.from("departments").insert({ name: p.data });
    if (error) return toast.error(error.message);
    await logAudit("Department created", p.data); setName(""); toast.success("Department added"); refresh();
  };

  const shown = depts.filter((d) => filter === "all" || d.id === filter);
  return (
    <div>
      <PageHeader title="Departments" description="Average user risk per department." actions={
        <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All departments</SelectItem>{depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
      } />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((d) => (
          <Panel key={d.id}>
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{d.name}</h2><RiskBadge level={d.level} /></div>
            <div className="stat-num mt-3 text-4xl font-semibold">{d.score}<span className="text-base text-muted-foreground">/100</span></div>
            <div className="mt-1 text-xs text-muted-foreground">Risk score · Status: {d.level}</div>
            <div className="mt-4 h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-primary" style={{ width: `${d.score}%` }} /></div>
            <dl className="mt-4 grid grid-cols-4 gap-2 text-xs">
              <div><dt className="text-muted-foreground">Users</dt><dd className="stat-num font-semibold">{d.users}</dd></div>
              <div><dt className="text-muted-foreground">Click</dt><dd className="stat-num font-semibold">{d.clickRate}%</dd></div>
              <div><dt className="text-muted-foreground">Report</dt><dd className="stat-num font-semibold">{d.reportRate}%</dd></div>
              <div><dt className="text-muted-foreground">Trained</dt><dd className="stat-num font-semibold">{d.trained}%</dd></div>
            </dl>
          </Panel>
        ))}
      </div>
      <Panel title="Add department" className="mt-6 max-w-md">
        <div className="flex gap-2"><Input placeholder="e.g. Radiology" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /><Button onClick={add}><Plus className="mr-1 h-4 w-4" />Add</Button></div>
      </Panel>
    </div>
  );
}
