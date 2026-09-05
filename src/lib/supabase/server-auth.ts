import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./client";
import { parseTargetLang, type TargetLang } from "@/lib/language";

export type UserRole = "teacher" | "student";

export interface AuthUser {
  id: string;
  email?: string | null;
  lang: TargetLang;
  role: UserRole;
}

function parseRole(v: unknown): UserRole {
  return v === "teacher" ? "teacher" : "student";
}

export async function getUserClient(
  request: Request,
): Promise<{ client: SupabaseClient; user: AuthUser } | null> {
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  return {
    client,
    user: {
      id: data.user.id,
      email: data.user.email,
      lang: parseTargetLang(data.user.user_metadata?.target_lang),
      role: parseRole(data.user.user_metadata?.role),
    },
  };
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "未登录或登录已过期" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
