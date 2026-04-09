"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type NotificationType =
  | "invitation_received"
  | "invitation_accepted"
  | "invitation_rejected"
  | "registration_success"
  | "payment_success"
  | "payment_failed"
  | "race_reminder"
  | "team_update"
  | "general"

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  metadata?: Record<string, unknown>
  created_at: string
}

export async function createNotification(data: {
  userId: string
  type: NotificationType
  title: string
  message: string
  metadata?: Record<string, unknown>
}) {
  const supabase = await createClient()

  const { error } = await supabase.from("notifications").insert({
    user_id: data.userId,
    type: data.type,
    title: data.title,
    message: data.message,
    metadata: data.metadata || {},
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  return { success: true }
}

export async function getNotifications(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    return { error: error.message, data: [] }
  }

  return { data: data as Notification[] }
}

export async function getUnreadCount(userId: string) {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false)

  if (error) {
    return { error: error.message, count: 0 }
  }

  return { count: count || 0 }
}

export async function markAsRead(notificationId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  return { success: true }
}

export async function markAllAsRead(userId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  return { success: true }
}

export async function deleteNotification(notificationId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  return { success: true }
}
