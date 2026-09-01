import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export type SuperAdminSession = {
  session: Session | null;
  isSuperAdmin: boolean;
};

/**
 * Same pattern as crossfit-dash-pro: Supabase Auth session + a check against
 * `user_roles` for role = 'super_admin'. Used by the `/auth` route and the
 * `/super-admin` guard.
 */
export async function getSuperAdminSession(): Promise<SuperAdminSession> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { session: null, isSuperAdmin: false };

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .eq("role", "super_admin")
    .limit(1);

  return { session, isSuperAdmin: !error && (data?.length ?? 0) > 0 };
}
