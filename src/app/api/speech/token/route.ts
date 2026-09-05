import { NextResponse } from "next/server";
import { getNlsToken, getAppKeyForLang } from "@/lib/aliyun/speech";
import { parseTargetLang } from "@/lib/language";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = parseTargetLang(searchParams.get("lang"));
  try {
    const token = await getNlsToken();
    const appkey = getAppKeyForLang(lang);
    return NextResponse.json({ token, appkey });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
