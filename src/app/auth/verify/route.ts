import { NextResponse, type NextRequest } from "next/server";

import { redeemSignInToken } from "@/lib/auth";

/**
 * Lands the customer from their emailed link. The token is single-use and
 * short-lived; anything else sends them back to /sign-in to request another.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const user = await redeemSignInToken(token, request.headers.get("user-agent"));

  if (!user) {
    return NextResponse.redirect(new URL("/sign-in?expired=1", request.url));
  }

  // New accounts have no name yet — send them to fill it in once.
  const destination = user.name ? "/account" : "/account/profile?welcome=1";
  return NextResponse.redirect(new URL(destination, request.url));
}
