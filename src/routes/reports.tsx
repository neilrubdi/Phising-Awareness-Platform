import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileDown, FilePlus } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { ErrorState, Loading, Panel, RiskBadge, fmtDateTime } from "@/components/common";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { logAudit, useAppData, useRefresh, type AppData } from "@/lib/data";
import { computeCampaignStats, computeDeptRisks, computeUserRisks, overallRisk, pct, trendSummary } from "@/lib/analytics";
import { DISCLAIMER } from "@/lib/content";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/reports")({
  head: () => pageHead("Reports", "Generate and export executive phishing-awareness reports as PDF."),
  component: ReportsPage,
});

function buildReport(d: AppData) {
  const risks = computeUserRisks(d);
  const stats = computeCampaignStats(d);
  const depts = computeDeptRisks(d, risks).sort((a, b) => b.score - a.score);
  const overall = overallRisk(risks);
  const trend = trendSummary(stats);
  const sent = stats.reduce((s, x) => s + x.delivered, 0);
  const clicked = stats.reduce((s, x) => s + x.clicked, 0);
  const reported = stats.reduce((s, x) => s + x.reported, 0);
  const trained = new Set(d.attempts.filter((a) => a.completed).map((a) => a.user_id)).size;
  const quiz = d.attempts.filter((a) => a.completed);
  const recs: string[] = [];
  if (depts[0]) recs.push(`Prioritise targeted training for ${depts[0].name} (risk ${depts[0].score}, ${depts[0].level}).`);
  if (pct(trained, d.users.length) < 80) recs.push(`Increase training coverage — only ${pct(trained, d.users.length)}% of users have completed a module.`);
  if (pct(reported, sent) < 60) recs.push("Promote the Report Phishing button; aim for a report rate above 60%.");
  recs.push("Run quarterly simulations with increasing difficulty to sustain awareness.");
  const critical = risks.filter((r) => r.level === "Critical" || r.level === "High").length;
  return {
    generated: new Date().toISOString(),
    executive: `Across ${stats.length} campaigns and ${d.users.length} fictional users, the overall phishing risk is ${overall.score} (${overall.level}). Click rate ${pct(clicked, sent)}%, report rate ${pct(reported, sent)}%.`,
    overall, trend, recs, critical,
    campaigns: stats.map((s) => ({ name: s.campaign.name, status: s.campaign.status, delivered: s.delivered, opened: s.opened, clicked: s.clicked, reported: s.reported, clickRate: s.clickRate, reportRate: s.reportRate })),
    depts: depts.map((x) => ({ name: x.name, score: x.score, level: x.level, clickRate: x.clickRate, reportRate: x.reportRate })),
    behaviour: { sent, opened: stats.reduce((s, x) => s + x.opened, 0), clicked, reported },
    training: { trainedUsers: trained, completions: quiz.length, avgScore: quiz.length ? Math.round(quiz.reduce((a, b) => a + b.score, 0) / quiz.length) : 0 },
  };
}
type Built = ReturnType<typeof buildReport>;

async function exportPdf(r: Built) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  let y = 18;
  doc.setFontSize(16); doc.text("Phishing Awareness Report — Aware Trust (Simulation)", 14, y); y += 7;
  doc.setFontSize(9); doc.text(`Generated ${new Date(r.generated).toLocaleString("en-GB")}`, 14, y); y += 8;
  const section = (t: string) => { doc.setFontSize(12); doc.text(t, 14, y); y += 6; doc.setFontSize(10); };
  const para = (t: string) => { const lines = doc.splitTextToSize(t, 180); doc.text(lines, 14, y); y += lines.length * 5 + 3; };
  section("Executive Summary"); para(r.executive);
  section("Risk Reduction"); para(r.trend ? `Click rate fell from ${r.trend.first.clickRate}% to ${r.trend.last.clickRate}% (${r.trend.reduction} pts).` : "Insufficient campaigns for trend.");
  section("User Behaviour"); para(`Delivered ${r.behaviour.sent}, opened ${r.behaviour.opened}, clicked ${r.behaviour.clicked}, reported ${r.behaviour.reported}. ${r.critical} users currently High or Critical risk.`);
  section("Training Results"); para(`${r.training.trainedUsers} users trained, ${r.training.completions} module completions, average quiz score ${r.training.avgScore}%.`);
  section("Campaign Overview");
  autoTable(doc, { startY: y, head: [["Campaign", "Status", "Delivered", "Opened", "Clicked", "Reported", "Click %", "Report %"]], body: r.campaigns.map((c) => [c.name, c.status, c.delivered, c.opened, c.clicked, c.reported, c.clickRate, c.reportRate]), styles: { fontSize: 8 } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;
  section("Department Risk / Top Risk Areas");
  autoTable(doc, { startY: y, head: [["Department", "Score", "Level", "Click %", "Report %"]], body: r.depts.map((d) => [d.name, d.score, d.level, d.clickRate, d.reportRate]), styles: { fontSize: 8 } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;
  section("Recommendations"); r.recs.forEach((x) => para(`• ${x}`));
  doc.setFontSize(8); para(DISCLAIMER);
  doc.save(`phishing-awareness-report-${r.generated.slice(0, 10)}.pdf`);
}

function ReportsPage() {
  const { data, isLoading, error } = useAppData();
  const refresh = useRefresh();
  const r = useMemo(() => (data ? buildReport(data) : null), [data]);
  const [busy, setBusy] = useState(false);
  if (isLoading) return <Loading />;
  if (error || !data || !r) return <ErrorState error={error} />;

  const generate = async () => {
    setBusy(true);
    const title = `Awareness report ${new Date().toLocaleDateString("en-GB")}`;
    const { error } = await supabase.from("reports").insert({ title, summary: r as never });
    if (error) { setBusy(false); toast.error(error.message); return; }
    await logAudit("Report generated", title);
    await exportPdf(r);
    setBusy(false); toast.success("Report generated and exported"); refresh();
  };

  return (
    <div>
      <PageHeader title="Reports" actions={<Button onClick={generate} disabled={busy}><FilePlus className="mr-1 h-4 w-4" />Generate & export PDF</Button>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Executive summary"><p className="text-sm">{r.executive}</p><div className="mt-3"><RiskBadge level={r.overall.level} score={r.overall.score} /></div></Panel>
          <Panel title="Risk reduction"><p className="text-sm">{r.trend ? `Phishing susceptibility reduced by ${r.trend.reduction}% — click rate ${r.trend.first.clickRate}% → ${r.trend.last.clickRate}%.` : "Not enough campaigns yet."}</p></Panel>
          <Panel title="Top risk areas">
            <ul className="divide-y text-sm">{r.depts.slice(0, 3).map((d) => <li key={d.name} className="flex justify-between py-2"><span>{d.name}</span><RiskBadge level={d.level as never} score={d.score} /></li>)}</ul>
          </Panel>
          <Panel title="Recommendations"><ul className="list-disc space-y-1 pl-5 text-sm">{r.recs.map((x) => <li key={x}>{x}</li>)}</ul></Panel>
        </div>
        <Panel title="Previously generated">
          {data.reports.length === 0 ? <p className="text-sm text-muted-foreground">No reports yet.</p> : (
            <ul className="divide-y text-sm">{[...data.reports].reverse().map((rep) => (
              <li key={rep.id} className="flex items-center justify-between py-2">
                <div><div className="font-medium">{rep.title}</div><div className="text-xs text-muted-foreground">{fmtDateTime(rep.created_at)}</div></div>
                <Button size="icon" variant="ghost" aria-label="Download" onClick={() => exportPdf(rep.summary as unknown as Built)}><FileDown className="h-4 w-4" /></Button>
              </li>
            ))}</ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
