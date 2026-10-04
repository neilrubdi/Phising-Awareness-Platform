import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { ErrorState, Loading, Panel, fmtDateTime } from "@/components/common";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppData } from "@/lib/data";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/audit")({
  head: () => pageHead("Audit Logs", "Append-only record of administrative and simulation actions."),
  component: AuditPage,
});

function AuditPage() {
  const { data, isLoading, error } = useAppData();
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} />;
  const actions = [...new Set(data.audit.map((a) => a.action))].sort();
  const rows = [...data.audit].reverse().filter((a) => (action === "all" || a.action === action) && (!q || `${a.actor} ${a.object} ${a.details}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <PageHeader title="Audit Logs" description={`${data.audit.length} entries · append-only`} />
      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="w-64 pl-8" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select value={action} onValueChange={setAction}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All actions</SelectItem>{actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Timestamp</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Object</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((a) => (
            <TableRow key={a.id}><TableCell className="stat-num whitespace-nowrap text-xs">{fmtDateTime(a.created_at)}</TableCell><TableCell>{a.actor}</TableCell><TableCell className="font-medium">{a.action}</TableCell><TableCell>{a.object}</TableCell><TableCell className="text-xs text-muted-foreground">{a.details}</TableCell></TableRow>
          ))}</TableBody>
        </Table>
      </Panel>
    </div>
  );
}
