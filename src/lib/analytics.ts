import type { AppData, Campaign, StaffUser } from "./data";

export const RISK_WEIGHTS = {
  base: 100,
  report: -15,
  trainingModule: -8,
  identified: -5, // opened but did not click
  click: 20,
  repeatFail: 10, // each click beyond the first
  noTraining: 10,
};

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export function riskLevel(score: number): RiskLevel {
  if (score < 25) return "Low";
  if (score < 50) return "Medium";
  if (score < 75) return "High";
  return "Critical";
}

export interface UserRisk {
  user: StaffUser;
  clicks: number;
  reports: number;
  opened: number;
  identified: number;
  delivered: number;
  modulesCompleted: number;
  avgQuiz: number | null;
  breakdown: { label: string; value: number }[];
  raw: number;
  score: number;
  level: RiskLevel;
  trainingStatus: "Complete" | "In progress" | "Not started" | "Assigned";
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

export function computeUserRisks(d: AppData): UserRisk[] {
  const byUser = new Map<string, { delivered: Set<string>; opened: Set<string>; clicked: Set<string>; reported: Set<string> }>();
  for (const u of d.users) byUser.set(u.id, { delivered: new Set(), opened: new Set(), clicked: new Set(), reported: new Set() });
  for (const i of d.interactions) {
    const b = byUser.get(i.user_id);
    if (!b) continue;
    (b[i.action as "delivered"] as Set<string>).add(i.message_id);
  }
  const completedByUser = new Map<string, Set<string>>();
  const assignedByUser = new Map<string, number>();
  const scoresByUser = new Map<string, number[]>();
  for (const a of d.attempts) {
    if (a.completed) {
      if (!completedByUser.has(a.user_id)) completedByUser.set(a.user_id, new Set());
      completedByUser.get(a.user_id)!.add(a.module_id);
      scoresByUser.set(a.user_id, [...(scoresByUser.get(a.user_id) ?? []), a.score]);
    } else assignedByUser.set(a.user_id, (assignedByUser.get(a.user_id) ?? 0) + 1);
  }
  const totalModules = d.modules.length || 6;

  return d.users.map((user) => {
    const b = byUser.get(user.id)!;
    const clicks = b.clicked.size;
    const reports = b.reported.size;
    const identified = [...b.opened].filter((m) => !b.clicked.has(m)).length;
    const modulesCompleted = completedByUser.get(user.id)?.size ?? 0;
    const scores = scoresByUser.get(user.id) ?? [];
    const breakdown = [
      { label: "Base risk", value: RISK_WEIGHTS.base },
      { label: `Reported simulations (${reports} × ${RISK_WEIGHTS.report})`, value: reports * RISK_WEIGHTS.report },
      { label: `Training modules completed (${modulesCompleted} × ${RISK_WEIGHTS.trainingModule})`, value: modulesCompleted * RISK_WEIGHTS.trainingModule },
      { label: `Correctly identified, not clicked (${identified} × ${RISK_WEIGHTS.identified})`, value: identified * RISK_WEIGHTS.identified },
      { label: `Simulated link clicks (${clicks} × +${RISK_WEIGHTS.click})`, value: clicks * RISK_WEIGHTS.click },
      { label: `Repeated failures (${Math.max(0, clicks - 1)} × +${RISK_WEIGHTS.repeatFail})`, value: Math.max(0, clicks - 1) * RISK_WEIGHTS.repeatFail },
      { label: "Ignored training (no modules completed)", value: modulesCompleted === 0 ? RISK_WEIGHTS.noTraining : 0 },
    ];
    const raw = breakdown.reduce((s, x) => s + x.value, 0);
    const score = clamp(raw);
    const assigned = assignedByUser.get(user.id) ?? 0;
    return {
      user, clicks, reports, opened: b.opened.size, identified, delivered: b.delivered.size, modulesCompleted,
      avgQuiz: scores.length ? Math.round(scores.reduce((a, c) => a + c, 0) / scores.length) : null,
      breakdown, raw, score, level: riskLevel(score),
      trainingStatus: modulesCompleted >= totalModules ? "Complete" : modulesCompleted > 0 ? "In progress" : assigned > 0 ? "Assigned" : "Not started",
    };
  });
}

export interface CampaignStats {
  campaign: Campaign;
  targeted: number;
  delivered: number;
  opened: number;
  clicked: number;
  reported: number;
  clickRate: number;
  reportRate: number;
  openRate: number;
  trainingCompletion: number;
}

export function computeCampaignStats(d: AppData): CampaignStats[] {
  const msgCampaign = new Map(d.messages.map((m) => [m.id, m.campaign_id]));
  const completedUsers = new Set(d.attempts.filter((a) => a.completed).map((a) => a.user_id));
  return d.campaigns.map((campaign) => {
    const sets = { delivered: new Set<string>(), opened: new Set<string>(), clicked: new Set<string>(), reported: new Set<string>() };
    for (const i of d.interactions) {
      if (msgCampaign.get(i.message_id) !== campaign.id) continue;
      sets[i.action as keyof typeof sets]?.add(i.user_id);
    }
    const targeted = campaign.target_department_id
      ? d.users.filter((u) => u.department_id === campaign.target_department_id).length
      : d.users.length;
    const delivered = sets.delivered.size;
    const trained = [...sets.delivered].filter((u) => completedUsers.has(u)).length;
    return {
      campaign, targeted, delivered, opened: sets.opened.size, clicked: sets.clicked.size, reported: sets.reported.size,
      clickRate: pct(sets.clicked.size, delivered), reportRate: pct(sets.reported.size, delivered),
      openRate: pct(sets.opened.size, delivered), trainingCompletion: pct(trained, delivered),
    };
  });
}

export interface DeptRisk { id: string; name: string; users: number; score: number; level: RiskLevel; clickRate: number; reportRate: number; trained: number }

export function computeDeptRisks(d: AppData, risks: UserRisk[]): DeptRisk[] {
  return d.departments.map((dep) => {
    const rs = risks.filter((r) => r.user.department_id === dep.id);
    const score = rs.length ? Math.round(rs.reduce((s, r) => s + r.score, 0) / rs.length) : 0;
    const delivered = rs.reduce((s, r) => s + r.delivered, 0);
    return {
      id: dep.id, name: dep.name, users: rs.length, score, level: riskLevel(score),
      clickRate: pct(rs.reduce((s, r) => s + r.clicks, 0), delivered),
      reportRate: pct(rs.reduce((s, r) => s + r.reports, 0), delivered),
      trained: pct(rs.filter((r) => r.modulesCompleted > 0).length, rs.length),
    };
  });
}

export function overallRisk(risks: UserRisk[]) {
  const s = risks.length ? Math.round(risks.reduce((a, r) => a + r.score, 0) / risks.length) : 0;
  return { score: s, level: riskLevel(s) };
}

export function trendSummary(stats: CampaignStats[]) {
  const run = stats.filter((s) => s.delivered > 0);
  if (run.length < 2) return null;
  const first = run[0], last = run[run.length - 1];
  return { first, last, reduction: Math.round((first.clickRate - last.clickRate) * 10) / 10 };
}
