import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

// ─── Dashboard auth (HTTP Basic Auth) ──────────────────────────────────────
// Protects the entire dashboard + API surface with a single shared credential.
// Configure DASHBOARD_USER and DASHBOARD_PASSWORD env vars in production.
// If either is unset we log a warning and let traffic through so local dev
// keeps working — never deploy to prod without both set.
//
// /api/vapi-webhook is intentionally excluded; that endpoint authenticates
// via the X-Vapi-Secret shared secret instead (see app/api/vapi-webhook/route.ts).

const PUBLIC_PATHS = [
  "/api/vapi-webhook",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="PowerFit Dashboard", charset="UTF-8"' },
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASSWORD;

  if (!user || !pass) {
    console.warn(
      "[middleware] DASHBOARD_USER/DASHBOARD_PASSWORD not set — allowing unauthenticated access. Set both in production."
    );
    return NextResponse.next();
  }

  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("basic ")) return unauthorized();

  let decoded: string;
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return unauthorized();
  }

  const sep = decoded.indexOf(":");
  if (sep === -1) return unauthorized();

  const providedUser = decoded.slice(0, sep);
  const providedPass = decoded.slice(sep + 1);

  if (!safeEqual(providedUser, user) || !safeEqual(providedPass, pass)) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next.js internals and common static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
