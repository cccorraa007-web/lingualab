import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./client";
import { verifySupabaseJwt } from "./jwt";

export interface AuthUser {
  id: string;
  email?: string | null;
}

export async function getUserClient(
  request: Request,
): Promise<{ client: SupabaseClient; user: AuthUser } | null> {
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  let userId: string | undefined;
  let email: string | undefined | null;

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (jwtSecret) {
    const claims = verifySupabaseJwt(token, jwtSecret);
    if (claims) {
      userId = claims.sub;
      email = claims.email;
    }
  }

  if (!userId) {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    userId = data.user.id;
    email = data.user.email;
  }

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  return {
    client,
    user: {
      id: userId,
      email,
    },
  };
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "未登录或登录已过期" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
