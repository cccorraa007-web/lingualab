import { NextResponse } from "next/server";
import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  const { data, error } = await supabase
    .from("mistake_book")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ mistakes: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await getUserClient(request);
  if (!auth) return unauthorized();
  const supabase = auth.client;

  let body: {
    items?: {
      error_type?: string;
      wrong?: string;
      correct?: string;
      example?: string;
      note?: string;
    }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { items } = body;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "缺少要保存的错题" }, { status: 400 });
  }

  const rows = items
    .filter((it) => it.wrong && it.correct)
    .map((it) => ({
      user_id: auth.user.id,
      error_type: it.error_type || "其他",
      wrong: it.wrong as string,
      correct: it.correct as string,
      example: it.example ?? null,
      note: it.note ?? null,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ error: "错题内容不完整" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("mistake_book")
    .insert(rows)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ count: data?.length ?? 0 });
}
