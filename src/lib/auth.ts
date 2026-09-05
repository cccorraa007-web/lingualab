"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { parseTargetLang, type TargetLang } from "@/lib/language";

export async function getSessionToken(): Promise<string | null> {
  const supabase = getSupabaseBrowser();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await getSessionToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

export async function signUp(
  email: string,
  password: string,
  lang: TargetLang,
): Promise<string | null> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { target_lang: lang } },
  });
  return error ? error.message : null;
}

export async function setTargetLang(lang: TargetLang): Promise<void> {
  const supabase = getSupabaseBrowser();
  await supabase.auth.updateUser({ data: { target_lang: lang } });
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseBrowser();
  await supabase.auth.signOut();
}

export function useAuth(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}

export function useTargetLang(): TargetLang {
  const { user } = useAuth();
  return parseTargetLang(user?.user_metadata?.target_lang);
}
