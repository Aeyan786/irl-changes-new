"use client"

import { useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"

type TableName = "invitations" | "notifications" | "registrations" | "payments" | "teams" | "races"

type SubscriptionCallback<T = Record<string, unknown>> = (
  payload: RealtimePostgresChangesPayload<T>
) => void

interface UseRealtimeOptions<T = Record<string, unknown>> {
  table: TableName
  event?: "INSERT" | "UPDATE" | "DELETE" | "*"
  filter?: string
  onInsert?: SubscriptionCallback<T>
  onUpdate?: SubscriptionCallback<T>
  onDelete?: SubscriptionCallback<T>
  onChange?: SubscriptionCallback<T>
  enabled?: boolean
}

export function useRealtime<T = Record<string, unknown>>({
  table,
  event = "*",
  filter,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
  enabled = true,
}: UseRealtimeOptions<T>) {
  const handleChange = useCallback(
    (payload: RealtimePostgresChangesPayload<T>) => {
      onChange?.(payload)

      switch (payload.eventType) {
        case "INSERT":
          onInsert?.(payload)
          break
        case "UPDATE":
          onUpdate?.(payload)
          break
        case "DELETE":
          onDelete?.(payload)
          break
      }
    },
    [onChange, onInsert, onUpdate, onDelete]
  )

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()
    let channel: RealtimeChannel

    const channelName = `realtime-${table}-${Date.now()}`

    const subscriptionConfig: {
      event: "INSERT" | "UPDATE" | "DELETE" | "*"
      schema: string
      table: string
      filter?: string
    } = {
      event,
      schema: "public",
      table,
    }

    if (filter) {
      subscriptionConfig.filter = filter
    }

    channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as const,
        subscriptionConfig,
        handleChange as (payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>) => void
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, event, filter, enabled, handleChange])
}

// Specific hooks for common use cases
export function useRealtimeInvitations(
  userId: string,
  onNewInvitation?: () => void
) {
  useRealtime({
    table: "invitations",
    event: "INSERT",
    filter: `to_user_id=eq.${userId}`,
    onInsert: () => {
      onNewInvitation?.()
    },
  })
}

export function useRealtimeNotifications(
  userId: string,
  onNewNotification?: () => void
) {
  useRealtime({
    table: "notifications",
    event: "INSERT",
    filter: `user_id=eq.${userId}`,
    onInsert: () => {
      onNewNotification?.()
    },
  })
}

export function useRealtimePayments(
  registrationId: string,
  onPaymentUpdate?: (status: string) => void
) {
  useRealtime<{ status: string }>({
    table: "payments",
    event: "UPDATE",
    filter: `registration_id=eq.${registrationId}`,
    onUpdate: (payload) => {
      if (payload.new && "status" in payload.new) {
        onPaymentUpdate?.(payload.new.status as string)
      }
    },
  })
}

export function useRealtimeRegistrations(
  teamId: string,
  onRegistrationChange?: () => void
) {
  useRealtime({
    table: "registrations",
    filter: `team_id=eq.${teamId}`,
    onChange: () => {
      onRegistrationChange?.()
    },
  })
}
