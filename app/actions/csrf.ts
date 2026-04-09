"use server"

import { setCsrfToken, getCsrfToken } from "@/lib/csrf"

export async function getOrCreateCsrfToken(): Promise<string> {
  let token = await getCsrfToken()
  
  if (!token) {
    token = await setCsrfToken()
  }
  
  return token
}
