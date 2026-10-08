/**
 * WordPress's default "Hello world!" post was still live on the old site. 410 Gone
 * tells search engines it was removed on purpose, so they drop it faster than a 404.
 */
export function GET() {
  return new Response("Gone", { status: 410, headers: { "Content-Type": "text/plain" } });
}
