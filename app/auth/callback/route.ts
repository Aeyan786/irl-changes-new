import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")

  // Handle error from Supabase
  if (error) {
    const errorMessage = errorDescription || error
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent(errorMessage)}`
    )
  }

  // Handle token_hash based recovery (password reset)
  if (tokenHash && type === "recovery") {
    const supabase = await createClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    })
    if (!verifyError) {
      return NextResponse.redirect(`${origin}/auth/reset-password`)
    }
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent(verifyError.message)}`
    )
  }

  // Handle PKCE code exchange
  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      // If a specific next URL was provided, use it
      if (next) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      // Otherwise, determine redirect based on user role
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single()

        if (profile?.role === "admin") {
          return NextResponse.redirect(`${origin}/admin/dashboard`)
        } else if (profile?.role === "manager") {
          return NextResponse.redirect(`${origin}/manager/dashboard`)
        } else {
          return NextResponse.redirect(`${origin}/runner/dashboard`)
        }
      }

      return NextResponse.redirect(`${origin}/auth/login`)
    }

    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent(exchangeError.message)}`
    )
  }

  // No code or token provided
  return NextResponse.redirect(`${origin}/auth/error?message=No%20code%20provided`)
}