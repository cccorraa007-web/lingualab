"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

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
  username: string,
): Promise<{ error: string | null; needsConfirm: boolean }> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username: username.trim() } },
  });
  if (error) return { error: error.message, needsConfirm: false };
  return { error: null, needsConfirm: !data.session };
}

export async function updateUsername(username: string): Promise<string | null> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.updateUser({
    data: { username: username.trim() },
  });
  return error ? error.message : null;
}

export async function updateEmail(email: string): Promise<string | null> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.updateUser({ email });
  return error ? error.message : null;
}

export async function updatePassword(password: string): Promise<string | null> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.updateUser({ password });
  return error ? error.message : null;
}

export async function updateAvatarUrl(url: string): Promise<string | null> {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.updateUser({ data: { avatar_url: url } });
  return error ? error.message : null;
}

export async function uploadAvatar(file: File): Promise<string> {
  const supabase = getSupabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("未登录");
  const ext = file.name.split(".").pop() || "png";
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file);
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
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

export function useUserInfo(): {
  username: string;
  email: string;
  avatarUrl: string;
} {
  const { user } = useAuth();
  return {
    username: (user?.user_metadata?.username as string) || "",
    email: user?.email ?? "",
    avatarUrl: (user?.user_metadata?.avatar_url as string) || "",
  };
}
