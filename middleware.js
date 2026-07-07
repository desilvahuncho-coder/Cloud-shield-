import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";

/**
 * Global Edge Security Gatekeeper.
 * Intercepts incoming route requests to verify active authentication sessions
 * before allowing any communication with background cloud connectors.
 */
export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Refresh session if expired - mandatory step for serverless edge routing consistency
  const { data: { session } } = await supabase.auth.getSession();

  const url = new URL(req.url);

  // 1. Secure API Gate: If accessing backend pipelines, session verification is mandatory
  if (url.pathname.startsWith("/api/feed") || url.pathname.startsWith("/api/actions")) {
    if (!session) {
      return NextResponse.json(
        { error: "Access denied. Please authenticate your user seat to clear this gate." },
        { status: 401 }
      );
    }
  }

  // 2. Protect Front-End Views: Bounce unauthenticated seats back to a login page
  // (Excluding internal auth redirects or asset endpoints)
  if (url.pathname === "/" && !session) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

// Ensure the middleware strictly intercepts only dashboard endpoints and API loops
export const config = {
  matcher: ["/", "/api/feed/:path*", "/api/actions/:path*"],
};
