import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ArrowLeft, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { ErrorState, Loading, Panel } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { logAudit, useAppData, useRefresh, type TrainingModule } from "@/lib/data";
import { LESSONS } from "@/lib/content";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/training")({
  head: () => pageHead("Training", "Short interactive phishing-awareness lessons with quizzes and completion tracking."),
  component: TrainingPage,
});

function TrainingPage() {
  const { data, isLoading, error } = useAppData();
  const refresh = useRefresh();
  const [userId, setUserId] = useState("");
  const [active, setActive] = useState<TrainingModule | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<number | null>(null);

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} />;
  const uid = userId || data.users[0]?.id || "";
  const learner = data.users.find((u) => u.id === uid);
  const best = (mid: string) => {
    const a = data.attempts.filter((x) => x.user_id === uid && x.module_id === mid);
    const done = a.filter((x) => x.completed);
    return { completed: done.length > 0, score: done.length ? Math.max(...done.map((x) => x.score)) : null, assigned: a.some((x) => !x.completed) };
  };
  const completion = (mid: string) => {
    const s = new Set(data.attempts.filter((a) => a.module_id === mid && a.completed).map((a) => a.user_id));
    return Math.round((s.size / (data.users.length || 1)) * 100);
  };

  const start = (m: TrainingModule) => { setActive(m); setAnswers({}); setResult(null); };
  const submit = async () => {
    if (!active) return;
    const lesson = LESSONS[active.slug];
    if (Object.keys(answers).length < lesson.quiz.length) return toast.error("Answer all questions first");
    const correct = lesson.quiz.filter((q, i) => answers[i] === q.answer).length;
    const score = Math.round((correct / lesson.quiz.length) * 100);
    const passed = score >= 50;
    const { error } = await supabase.from("training_attempts").insert({ user_id: uid, module_id: active.id, score, completed: passed, status: passed ? "completed" : "assigned" });
    if (error) return toast.error(error.message);
    if (passed) await logAudit("User completed training", active.title, `${learner?.name} scored ${score}%`, learner?.name ?? "User");
    setResult(score); refresh();
    toast[passed ? "success" : "error"](passed ? `Module complete — ${score}%` : `Scored ${score}%. Try again to complete.`);
  };

  return (
    <div>
      <PageHeader title="Training" description="Complete lessons as a fictional learner." actions={
        <Select value={uid} onValueChange={(v) => { setUserId(v); setActive(null); }}><SelectTrigger className="w-64"><SelectValue /></SelectTrigger><SelectContent>{data.users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select>
      } />
      {!active ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.modules.map((m) => {
            const b = best(m.id);
            return (
              <Panel key={m.id}>
                <div className="flex items-start justify-between gap-2"><BookOpen className="h-5 w-5 text-primary" />{b.completed ? <Badge className="bg-risk-low text-primary-foreground">Completed · {b.score}%</Badge> : b.assigned ? <Badge variant="outline">Assigned</Badge> : <Badge variant="secondary">Not started</Badge>}</div>
                <h2 className="mt-3 font-semibold">{m.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                <div className="mt-4 text-xs text-muted-foreground">Organisation completion {completion(m.id)}%</div>
                <Progress value={completion(m.id)} className="mt-1 h-1.5" />
                <Button className="mt-4 w-full" variant={b.completed ? "outline" : "default"} onClick={() => start(m)}>{b.completed ? "Retake" : "Start lesson"}</Button>
              </Panel>
            );
          })}
        </div>
      ) : (
        <div className="max-w-3xl space-y-4">
          <Button variant="ghost" onClick={() => setActive(null)}><ArrowLeft className="mr-1 h-4 w-4" />All modules</Button>
          <Panel title={active.title}>
            <div className="space-y-2 text-sm">{LESSONS[active.slug].explanation.map((p) => <p key={p}>{p}</p>)}</div>
            <h3 className="mt-5 text-sm font-semibold">Examples</h3>
            <ul className="mt-2 space-y-1.5">{LESSONS[active.slug].examples.map((e) => <li key={e} className="rounded-md border-l-4 border-risk-high bg-muted px-3 py-2 text-sm">{e}</li>)}</ul>
          </Panel>
          <Panel title="Mini quiz">
            <div className="space-y-5">
              {LESSONS[active.slug].quiz.map((q, qi) => (
                <div key={qi}>
                  <p className="mb-2 text-sm font-medium">{qi + 1}. {q.q}</p>
                  <div className="grid gap-2">
                    {q.options.map((o, oi) => {
                      const chosen = answers[qi] === oi;
                      const show = result !== null;
                      return (
                        <button key={oi} disabled={show} onClick={() => setAnswers({ ...answers, [qi]: oi })}
                          className={cn("rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                            chosen && "border-primary bg-accent",
                            show && oi === q.answer && "border-risk-low bg-risk-low/10",
                            show && chosen && oi !== q.answer && "border-destructive bg-destructive/10")}>
                          {String.fromCharCode(65 + oi)}. {o}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {result === null ? <Button className="mt-5" onClick={submit}>Submit answers</Button> : (
              <div className="mt-5 flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-risk-low" /><span className="text-sm">Score: <strong className="stat-num">{result}%</strong> {result >= 50 ? "— module completed" : "— not passed"}</span><Button variant="outline" size="sm" onClick={() => start(active)}>Retry</Button></div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
