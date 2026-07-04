import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()
  
  // Directly read the Supabase authentication cookie using standard Web APIs
  // Supabase stores tokens under 'sb-<project-id>-auth-token' or 'supabase-auth-token'
  const allCookies = req.cookies.getAll()
  const hasAuthCookie = allCookies.some(cookie => cookie.name.includes('auth-token'))

  // Optional: If you want to block unauthorized access to a folder like /dashboard
  // if (req.nextUrl.pathname.startsWith('/dashboard') && !hasAuthCookie) {
  //   return NextResponse.redirect(new URL('/login', req.url))
  // }

  return res
}

// Ensure the middleware completely ignores static assets
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
