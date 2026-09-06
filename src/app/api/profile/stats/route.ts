import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;
  const userId = auth.user.id;

  const [materials, cards, mistakes, memberships] = await Promise.all([
    supabase
      .from("materials")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("corpus_cards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("mistake_book")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("classroom_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "approved"),
  ]);

  return NextResponse.json({
    selfStudy: {
      materials: materials.count ?? 0,
      cards: cards.count ?? 0,
      mistakes: mistakes.count ?? 0,
    },
    classroom: {
      classes: memberships.count ?? 0,
    },
  });
}
