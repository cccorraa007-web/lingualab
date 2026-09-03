import { NextResponse } from "next/server";
import { getNlsToken, getAppKey } from "@/lib/aliyun/speech";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = await getNlsToken();
    const appkey = getAppKey();
    return NextResponse.json({ token, appkey });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
