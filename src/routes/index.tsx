import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Users, Megaphone, Send, MailOpen, MousePointerClick, Flag, GraduationCap, ShieldAlert } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, PieChart, Pie, Cell,
} from "recharts";
import { PageHeader } from "@/components/AppShell";
import { ErrorState, Loading, Panel, RiskBadge, StatCard } from "@/components/common";
import { useAppData } from "@/lib/data";
import { computeCampaignStats, computeDeptRisks, computeUserRisks, overallRisk, trendSummary } from "@/lib/analytics";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => pageHead("Dashboard", "Overview of simulated phishing campaigns, click and report rates, training and human-risk scores."),
  component: Dashboard,
});

const shortName = (n: string) => n.replace(" Simulation", "").replace(" Notification", "");

function Dashboard() {
  const { data, isLoading, error } = useAppData();
  const m = useMemo(() => {
    if (!data) return null;
    const risks = computeUserRisks(data);
    const stats = computeCampaignStats(data);
    const depts = computeDeptRisks(data, risks);
    const count = (a: string) => data.interactions.filter((i) => i.action === a).length;
    const trainedUsers = new Set(data.attempts.filter((a) => a.completed).map((a) => a.user_id)).size;
    return { risks, stats, depts, overall: overallRisk(risks), trend: trendSummary(stats), sent: count("delivered"), opened: count("opened"), clicked: count("clicked"), reported: count("reported"), trainedUsers, completedAttempts: data.attempts.filter((a) => a.completed).length };
  }, [data]);

  if (isLoading) return <Loading />;
  if (error || !data || !m) return <ErrorState error={error} />;

  const timeline = m.stats.filter((s) => s.delivered).map((s) => ({ name: shortName(s.campaign.name), "Click rate": s.clickRate, "Report rate": s.reportRate, "Open rate": s.openRate }));
  const risksOverTime = m.stats.filter((s) => s.delivered).map((s) => ({ name: shortName(s.campaign.name), "Risk index": Math.round(s.clickRate * 2 + (100 - s.reportRate) * 0.5) }));
  const trainingPie = [
    { name: "Trained", value: m.trainedUsers },
    { name: "Not trained", value: data.users.length - m.trainedUsers },
  ];

  return (
    <div>
      <PageHeader title="Security Awareness Dashboard" description="Live metrics across all simulated campaigns." />
      {m.trend && (
        <div className="mb-6 rounded-lg border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
          Phishing susceptibility {m.trend.reduction >= 0 ? "reduced" : "increased"} by <strong className="stat-num">{Math.abs(m.trend.reduction)} pts</strong> — click rate went from {m.trend.first.clickRate}% ({m.trend.first.campaign.name}) to {m.trend.last.clickRate}% ({m.trend.last.campaign.name}).
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total users" value={data.users.length} icon={Users} sub={`${data.departments.length} departments`} />
        <StatCard label="Active campaigns" value={data.campaigns.filter((c) => c.status === "Active").length} icon={Megaphone} sub={`${data.campaigns.length} total`} />
        <StatCard label="Messages sent" value={m.sent} icon={Send} />
        <StatCard label="Messages opened" value={m.opened} icon={MailOpen} sub={`${Math.round((m.opened / (m.sent || 1)) * 100)}% open rate`} />
        <StatCard label="Simulated clicks" value={m.clicked} icon={MousePointerClick} tone="text-risk-high" sub={`${Math.round((m.clicked / (m.sent || 1)) * 100)}% click rate`} />
        <StatCard label="Reported" value={m.reported} icon={Flag} tone="text-risk-low" sub={`${Math.round((m.reported / (m.sent || 1)) * 100)}% report rate`} />
        <StatCard label="Training completed" value={m.completedAttempts} icon={GraduationCap} sub={`${m.trainedUsers} users trained`} />
        <StatCard label="Overall phishing risk" value={m.overall.score} icon={ShieldAlert} sub={<RiskBadge level={m.overall.level} />} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Click rate vs report rate by campaign">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" fontSize={11} /><YAxis unit="%" fontSize={11} />
              <Tooltip /><Legend />
              <Line type="monotone" dataKey="Click rate" stroke="var(--risk-high)" strokeWidth={2} />
              <Line type="monotone" dataKey="Report rate" stroke="var(--risk-low)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Risk by department">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={m.depts}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" fontSize={11} /><YAxis domain={[0, 100]} fontSize={11} />
              <Tooltip />
              <Bar dataKey="score" name="Risk score" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Risk over time">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={risksOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="Risk index" stroke="var(--chart-1)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Training completion">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={trainingPie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                <Cell fill="var(--chart-2)" /><Cell fill="var(--muted)" />
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Campaign performance" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={m.stats.map((s) => ({ name: shortName(s.campaign.name), Opened: s.opened, Clicked: s.clicked, Reported: s.reported }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} />
              <Tooltip /><Legend />
              <Bar dataKey="Opened" fill="var(--chart-1)" />
              <Bar dataKey="Clicked" fill="var(--risk-high)" />
              <Bar dataKey="Reported" fill="var(--risk-low)" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
}
