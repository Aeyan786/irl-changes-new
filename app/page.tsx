import { redirect } from "next/navigation"

export default function HomePage() {
  // Redirect to auth login page - middleware handles auth state
  redirect("/auth/login")
}
