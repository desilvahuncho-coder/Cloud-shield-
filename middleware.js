import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()
  
  // Create the authenticated middleware client safely
  const supabase = createMiddlewareClient({ req, res })

  // Check the user session without invoking heavy Node APIs
  await supabase.auth.getSession()

  return res
}

// Ensure the middleware ONLY runs on matching application paths
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
