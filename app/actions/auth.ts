"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

export type SignUpData = {
  email: string
  password: string
  role: "runner" | "manager"
  firstName: string
  lastName: string
  street: string
  city: string
  state: string
  zipCode: string
  age: number
  gender: "male" | "female" | "other"
  pastAchievements?: string
  disabilities?: string
}
export async function signUp(formData: SignUpData) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,

    options: {
      emailRedirectTo:
        process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
        `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,

      data: {
        first_name: formData.firstName,
        last_name: formData.lastName,
        full_name: `${formData.firstName} ${formData.lastName}`,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  const user = data.user

  if (!user) {
    return { error: "User not created" }
  }

  // Use admin client to bypass RLS since user session isn't established yet
  const { createClient: createAdminClient } = await import("@supabase/supabase-js")
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error: profileError } = await admin
    .from("users")
    .upsert({
      id: user.id, 

      email: formData.email,
      role: formData.role || "runner",

      first_name: formData.firstName,
      last_name: formData.lastName,

      address: {
        street: formData.street,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
      },

      age: formData.age,
      gender: formData.gender,

      past_achievements: formData.pastAchievements || null,
      disabilities: formData.disabilities || null,
    })

  if (profileError) {
    return { error: profileError.message }
  }

  return { success: true }
}
export async function signIn(formData: { email: string; password: string }) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  return { success: true, data }
}

export async function signInWithMagicLink(email: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo:
        process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
        `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function forgotPassword(email: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo:
      process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function resetPassword(password: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  return { success: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/auth/login")
}

export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function verifyOtp(email: string, token: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  return { success: true, data }
}

export type UpdateProfileData = {
  firstName: string
  lastName: string
  phone?: string
  street: string
  city: string
  state: string
  zipCode: string
  age: number
  gender: "male" | "female" 
  pastAchievements?: string
  disabilities?: string
}

export async function updateProfile(formData: UpdateProfileData) {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  // Update user metadata in auth
  const { error: authError } = await supabase.auth.updateUser({
    data: {
      first_name: formData.firstName,
      last_name: formData.lastName,
      street: formData.street,
      city: formData.city,
      state: formData.state,
      zip_code: formData.zipCode,
      age: formData.age,
      gender: formData.gender,
      past_achievements: formData.pastAchievements || null,
      disabilities: formData.disabilities || null,
    },
  })

  if (authError) {
    return { error: authError.message }
  }

  // Update users table - address is stored as JSONB
  const { error: dbError } = await supabase
    .from("users")
    .update({
      first_name: formData.firstName,
      last_name: formData.lastName,
      address: {
        street: formData.street,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
      },
      phone: formData.phone || null,
      age: formData.age,
      gender: formData.gender,
      past_achievements: formData.pastAchievements || null,
      disabilities: formData.disabilities || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (dbError) {
    return { error: dbError.message }
  }

  revalidatePath("/", "layout")
  return { success: true }
}

export async function changePassword(oldPassword: string, newPassword: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user || !user.email) {
    return { error: "Not authenticated" }
  }

  // First verify the old password by signing in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: oldPassword,
  })

  if (signInError) {
    return { error: "Current password is incorrect" }
  }

  // Update to new password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath("/", "layout")
  return { success: true }
}

export async function changeEmail(newEmail: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  // Check if the new email is the same as current
  if (user.email?.toLowerCase() === newEmail.toLowerCase()) {
    return { error: "New email must be different from your current email" }
  }

  // Check if email is already in use by another user
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", newEmail.toLowerCase())
    .neq("id", user.id)
    .single()

  if (existingUser) {
    return { error: "This email address is already in use by another account" }
  }

  // Update email - Supabase sends verification only to the new email address
  // Note: "Secure email change" must be DISABLED in Supabase Dashboard > Auth > Email
  // to avoid requiring confirmation from the old email as well.
  const { error } = await supabase.auth.updateUser({
    email: newEmail,
  }, {
    emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
  })

  if (error) {
    // Handle specific Supabase error for email already in use
    if (error.message.includes("already registered") || error.message.includes("already been registered")) {
      return { error: "This email address is already in use by another account" }
    }
    return { error: error.message }
  }

  return { success: true }
}