// middleware.js
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";

/**
 * Universal Security Edge Interceptor
 * Guards API routing vectors against unauthorized execution attempts before hitting execution logic.
 */
export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Refresh user session lifecycle tokens securely on demand
  const { data: { session } } = await supabase.auth.getSession();

  // Route Guard Pattern: Strict validation over API routes
  if (req.nextUrl.pathname.startsWith("/api/")) {
    // Exclude basic auth endpoints from active route block filters
    if (req.nextUrl.pathname.startsWith("/api/auth")) {
      return res;
    }

    // If an incoming call hits a problem feed or action endpoint without an active session cookie token, eject instantly
    if (!session) {
      return new NextResponse(
        JSON.stringify({ error: "Security protocol routing fault: Invalid session configuration" }),
        { status: 401, headers: { "content-type": "application/json" } }
      );
    }
  }

  return res;
}

export const config = {
  matcher: ["/api/feed/:path*", "/api/actions/:path*"],
};
