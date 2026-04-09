import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Check if Supabase credentials are available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return early if Supabase is not configured
    return supabaseResponse
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getUser() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Define auth routes (login, signup, etc.) - these should be accessible without auth
  const authRoutes = [
    '/auth/login', 
    '/auth/sign-up', 
    '/auth/forgot-password', 
    '/auth/sign-up-success',
    '/auth/admin-login',
    '/invite',
  ]
  const isAuthRoute = authRoutes.some(route => pathname === route || pathname.startsWith(route))

  // Reset password page should always be accessible even when authenticated
  const isResetPasswordRoute = pathname === '/auth/reset-password'
  if (isResetPasswordRoute) {
    return supabaseResponse
  }

  // Define protected routes that require authentication
  const protectedRoutes = ['/runner', '/manager', '/admin', '/portal-select']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route)) && !isAuthRoute

  // If user is not authenticated and trying to access protected route, redirect to login
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    // Redirect to admin login if trying to access admin routes, otherwise regular login
    url.pathname = pathname.startsWith('/admin') ? '/auth/admin-login' : '/auth/login'
    return NextResponse.redirect(url)
  }

  // If user is authenticated and on auth pages (except invite), redirect to appropriate dashboard
  if (isAuthRoute && user && !pathname.startsWith('/invite')) {
    // Fetch user role to redirect to correct dashboard
    const { data: userData, error: userError } = await Promise.race([
      supabase.from('users').select('role').eq('id', user.id).single(),
      new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 3000)
      ),
    ]) as any

    // If we can't get user data, don't redirect to prevent loops - let them stay on auth page
    if (userError || !userData?.role) {
      return supabaseResponse
    }

    const url = request.nextUrl.clone()
    if (userData.role === 'admin') {
      url.pathname = '/admin/dashboard'
    } else if (userData.role === 'manager') {
      url.pathname = '/manager/dashboard'
    } else if (userData.role === 'assistant_manager') {
      // AMs choose their portal on login
      url.pathname = '/portal-select'
    } else {
      url.pathname = '/runner/dashboard'
    }
    return NextResponse.redirect(url)
  }

  // Redirect root path to login page
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
