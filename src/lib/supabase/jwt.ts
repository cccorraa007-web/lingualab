import { createHmac, timingSafeEqual } from "crypto";

export interface JwtClaims {
  sub: string;
  email?: string;
  username?: string;
}

export function verifySupabaseJwt(token: string, secret: string): JwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;
  try {
    const expected = createHmac("sha256", secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest();
    const provided = Buffer.from(signatureB64, "base64url");
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) {
      return null;
    }
    if (typeof payload.sub !== "string") return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      username:
        payload.user_metadata &&
        typeof payload.user_metadata.username === "string"
          ? payload.user_metadata.username
          : undefined,
    };
  } catch {
    return null;
  }
}
