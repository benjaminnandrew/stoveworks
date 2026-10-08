import { NextResponse, type NextRequest } from "next/server";

/**
 * Trailing slashes for pages only.
 *
 * Page URLs end in a slash to match the WordPress site (see next.config.ts). Next's
 * own trailingSlash redirect would also bounce every /api/ and /auth/ request
 * through a 308, so it's switched off (skipTrailingSlashRedirect) and done here
 * for pages instead. The matcher keeps API routes, auth, Next internals and
 * anything with a file extension out of it.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.endsWith("/")) return NextResponse.next();

  // A plain URL, not nextUrl.clone(): NextURL re-applies its own trailing-slash
  // formatting on output and drops the slash this adds.
  const url = new URL(request.url);
  url.pathname = `${pathname}/`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/((?!api/|auth/|_next/|.*\\.).*)"],
};
