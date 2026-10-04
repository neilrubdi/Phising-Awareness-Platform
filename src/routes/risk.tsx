import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { PageHeader } from "@/components/AppShell";
import { ErrorState, Loading, Panel, RiskBadge } from "@/components/common";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppData } from "@/lib/data";
import { RISK_WEIGHTS, computeCampaignStats, computeUserRisks, trendSummary, type RiskLevel } from "@/lib/analytics";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/risk")({
  head: () => pageHead("Risk Analysis", "Human-risk scoring methodology, distribution and susceptibility trends across campaigns."),
  component: RiskPage,
});

const LEVELS: RiskLevel[] = ["Low", "Medium", "High", "Critical"];
const LEVEL_COLOR: Record<RiskLevel, string> = { Low: "var(--risk-low)", Medium: "var(--risk-medium)", High: "var(--risk-high)", Critical: "var(--risk-critical)" };

function RiskPage() {
  const { data, isLoading, error } = useAppData();
  const [dept, setDept] = useState("all");
  const m = useMemo(() => {
    if (!data) return null;
    const risks = computeUserRisks(data);
    const stats = computeCampaignStats(data);
    return { risks, stats, trend: trendSummary(stats) };
  }, [data]);
  if (isLoading) return <Loading />;
  if (error || !data || !m) return <ErrorState error={error} />;

  const rs = m.risks.filter((r) => dept === "all" || r.user.department_id === dept);
  const dist = LEVELS.map((l) => ({ level: l, users: rs.filter((r) => r.level === l).length }));
  const top = [...rs].sort((a, b) => b.score - a.score).slice(0, 10);
  const trend = m.stats.filter((s) => s.delivered).map((s, i) => ({ name: `C${i + 1}`, full: s.campaign.name, "Click rate": s.clickRate }));

  return (
    <div>
      <PageHeader title="Risk Analysis" actions={
        <Select value={dept} onValueChange={setDept}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All departments</SelectItem>{data.departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
      } />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Scoring methodology">
          <table className="w-full text-sm"><tbody>
            <tr className="border-b"><td className="py-1.5">Base risk</td><td className="stat-num text-right">{RISK_WEIGHTS.base}</td></tr>
            <tr className="border-b"><td className="py-1.5">Each reported simulation</td><td className="stat-num text-right text-risk-low">{RISK_WEIGHTS.report}</td></tr>
            <tr className="border-b"><td className="py-1.5">Each training module completed</td><td className="stat-num text-right text-risk-low">{RISK_WEIGHTS.trainingModule}</td></tr>
            <tr className="border-b"><td className="py-1.5">Each message correctly identified (opened, not clicked)</td><td className="stat-num text-right text-risk-low">{RISK_WEIGHTS.identified}</td></tr>
            <tr className="border-b"><td className="py-1.5">Each simulated link click</td><td className="stat-num text-right text-risk-high">+{RISK_WEIGHTS.click}</td></tr>
            <tr className="border-b"><td className="py-1.5">Each repeated failure (clicks beyond first)</td><td className="stat-num text-right text-risk-high">+{RISK_WEIGHTS.repeatFail}</td></tr>
            <tr className="border-b"><td className="py-1.5">Ignored training (none completed)</td><td className="stat-num text-right text-risk-high">+{RISK_WEIGHTS.noTraining}</td></tr>
          </tbody></table>
          <p className="mt-3 text-xs text-muted-foreground">Score is clamped to 0–100. Low &lt; 25 · Medium &lt; 50 · High &lt; 75 · Critical ≥ 75.</p>
        </Panel>
        <Panel title="Risk distribution">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dist}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="level" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip />
              <Bar dataKey="users" radius={[4, 4, 0, 0]}>{dist.map((d) => <Cell key={d.level} fill={LEVEL_COLOR[d.level]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Risk trend across campaigns">
          {m.trend && <p className="mb-3 text-sm">Phishing susceptibility {m.trend.reduction >= 0 ? "reduced" : "increased"} by <strong className="stat-num">{Math.abs(m.trend.reduction)}%</strong> (click rate {m.trend.first.clickRate}% → {m.trend.last.clickRate}%).</p>}
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" fontSize={11} /><YAxis unit="%" fontSize={11} /><Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ""} />
              <Line dataKey="Click rate" stroke="var(--risk-high)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">{trend.map((t) => <li key={t.name}>{t.name}: {t.full} = {t["Click rate"]}%</li>)}</ul>
        </Panel>
        <Panel title="Highest-risk users">
          <ul className="divide-y text-sm">{top.map((r) => (
            <li key={r.user.id} className="flex items-center justify-between py-2">
              <div><div className="font-medium">{r.user.name}</div><div className="text-xs text-muted-foreground">{r.clicks} clicks · {r.reports} reports · {r.modulesCompleted} modules</div></div>
              <RiskBadge level={r.level} score={r.score} />
            </li>
          ))}</ul>
        </Panel>
      </div>
    </div>
  );
}
