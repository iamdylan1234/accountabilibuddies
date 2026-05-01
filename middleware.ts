import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Detect Supabase auth cookie — works without @supabase/ssr in Edge runtime
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1] ?? ''
  const hasAuth =
    request.cookies.has(`sb-${projectRef}-auth-token`) ||
    request.cookies.has(`sb-${projectRef}-auth-token.0`) ||
    request.cookies.getAll().some(c => c.name.includes('-auth-token'))

  const protectedRoutes = ['/dashboard', '/setup', '/month', '/wrap-up']
  const isProtected = protectedRoutes.some(r => pathname.startsWith(r))

  if (isProtected && !hasAuth) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (hasAuth && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
