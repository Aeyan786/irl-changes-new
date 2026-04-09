import { cookies } from "next/headers"

const CSRF_TOKEN_COOKIE = "csrf_token"
const CSRF_TOKEN_HEADER = "x-csrf-token"

// Generate a random CSRF token
export function generateCsrfToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

// Set CSRF token in cookie
export async function setCsrfToken(): Promise<string> {
  const token = generateCsrfToken()
  const cookieStore = await cookies()
  
  cookieStore.set(CSRF_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60, // 1 hour
    path: "/",
  })
  
  return token
}

// Get CSRF token from cookie
export async function getCsrfToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(CSRF_TOKEN_COOKIE)?.value
}

// Validate CSRF token from header against cookie
export async function validateCsrfToken(headers: Headers): Promise<boolean> {
  const headerToken = headers.get(CSRF_TOKEN_HEADER)
  const cookieToken = await getCsrfToken()
  
  if (!headerToken || !cookieToken) {
    return false
  }
  
  // Constant-time comparison to prevent timing attacks
  if (headerToken.length !== cookieToken.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < headerToken.length; i++) {
    result |= headerToken.charCodeAt(i) ^ cookieToken.charCodeAt(i)
  }
  
  return result === 0
}
