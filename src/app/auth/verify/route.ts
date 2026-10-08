import { NextResponse, type NextRequest } from "next/server";

import { redeemSignInToken } from "@/lib/auth";
import { safeNextPath } from "@/lib/site-url";

/**
 * Lands the customer from their emailed link. The token is single-use and
 * short-lived; anything else sends them back to /sign-in to request another.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const user = await redeemSignInToken(token, request.headers.get("user-agent"));

  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (!user) {
    const retry = `/sign-in/?expired=1${next ? `&next=${encodeURIComponent(next)}` : ""}`;
    return NextResponse.redirect(new URL(retry, request.url));
  }

  // Back to whatever they signed in to save, when there is one. Otherwise new
  // accounts have no name yet — send them to fill it in once.
  const destination = next ?? (user.name ? "/account/" : "/account/profile/?welcome=1");
  return NextResponse.redirect(new URL(destination, request.url));
}
