import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Department = Tables<"departments">;
export type StaffUser = Tables<"staff_users">;
export type Campaign = Tables<"campaigns">;
export type SimMessage = Tables<"simulation_messages">;
export type Interaction = Tables<"user_interactions">;
export type TrainingModule = Tables<"training_modules">;
export type TrainingAttempt = Tables<"training_attempts">;
export type AuditLog = Tables<"audit_logs">;
export type Report = Tables<"reports">;

type TableName =
  | "departments" | "staff_users" | "campaigns" | "simulation_messages" | "user_interactions"
  | "training_modules" | "training_attempts" | "audit_logs" | "reports";

// Paginates past the 1000-row default limit.
async function fetchAll<T>(table: TableName, order = "created_at"): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(order, { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + size - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < size) break;
  }
  return out;
}

export interface AppData {
  departments: Department[];
  users: StaffUser[];
  campaigns: Campaign[];
  messages: SimMessage[];
  interactions: Interaction[];
  modules: TrainingModule[];
  attempts: TrainingAttempt[];
  audit: AuditLog[];
  reports: Report[];
}

export const APP_DATA_KEY = ["app-data"];

export function useAppData() {
  return useQuery({
    queryKey: APP_DATA_KEY,
    queryFn: async (): Promise<AppData> => {
      const [departments, users, campaigns, messages, interactions, modules, attempts, audit, reports] =
        await Promise.all([
          fetchAll<Department>("departments", "name"),
          fetchAll<StaffUser>("staff_users", "employee_code"),
          fetchAll<Campaign>("campaigns", "start_date"),
          fetchAll<SimMessage>("simulation_messages", "sent_at"),
          fetchAll<Interaction>("user_interactions"),
          fetchAll<TrainingModule>("training_modules", "sort_order"),
          fetchAll<TrainingAttempt>("training_attempts"),
          fetchAll<AuditLog>("audit_logs"),
          fetchAll<Report>("reports"),
        ]);
      return { departments, users, campaigns, messages, interactions, modules, attempts, audit, reports };
    },
    staleTime: 30_000,
  });
}

export function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: APP_DATA_KEY });
}

export const ADMIN_ACTOR = "Security Admin";

export async function logAudit(action: string, object: string, details = "", actor = ADMIN_ACTOR) {
  await supabase.from("audit_logs").insert({
    actor: actor.slice(0, 150),
    action: action.slice(0, 100),
    object: object.slice(0, 200),
    details: details.slice(0, 1000),
  });
}

export async function recordInteraction(userId: string, messageId: string, action: "opened" | "clicked" | "reported") {
  const { error } = await supabase
    .from("user_interactions")
    .upsert({ user_id: userId, message_id: messageId, action }, { onConflict: "user_id,message_id,action", ignoreDuplicates: true });
  if (error) throw error;
}
