"use client"

import { useState, useEffect, useCallback } from "react"
import { Bell, Check, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useRouter, usePathname } from "next/navigation"
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  type Notification,
} from "@/app/actions/notifications"
import { useRealtime } from "@/hooks/use-realtime"

interface NotificationBellProps {
  userId: string
}

function getNotificationUrl(notification: Notification, pathname: string): string | null {
  const meta = notification.metadata || {}
  const isManagerPortal = pathname.startsWith("/manager") || pathname.startsWith("/admin")
  const isAdminPortal = pathname.startsWith("/admin")

  switch (notification.type) {
    case "invitation_received":
      // Manager received a join request
      if (isManagerPortal) return "/manager/teams"
      // Runner received a team or AM invitation
      return "/runner/invitations"

    case "invitation_accepted":
      if (isAdminPortal) return "/admin/teams"
      if (isManagerPortal) return "/manager/teams"
      return "/runner/teams"

    case "invitation_rejected":
      if (isManagerPortal) return "/manager/invitations"
      return "/runner/invitations"

    case "registration_success":
      if (isAdminPortal) return "/admin/registrations"
      if (isManagerPortal) return "/manager/registrations"
      return "/runner/races"

    case "payment_success":
    case "payment_failed":
      if (isAdminPortal) return "/admin/payments"
      if (isManagerPortal) return "/manager/payments"
      return "/runner/dashboard"

    case "race_reminder":
      if (isAdminPortal) return "/admin/races"
      if (isManagerPortal) return "/manager/races"
      return "/runner/races"

    case "team_update":
      if (isAdminPortal) return "/admin/teams"
      if (isManagerPortal) return "/manager/teams"
      return "/runner/teams"

    default:
      return null
  }
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const fetchNotifications = useCallback(async () => {
    const [notifResult, countResult] = await Promise.all([
      getNotifications(userId),
      getUnreadCount(userId),
    ])

    if (notifResult.data) {
      setNotifications(notifResult.data)
    }
    setUnreadCount(countResult.count ?? 0)
  }, [userId])

  useRealtime({
    table: "notifications",
    event: "*",
    filter: `user_id=eq.${userId}`,
    onChange: () => {
      fetchNotifications()
    },
  })

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  useEffect(() => {
    if (!isOpen) return
    fetchNotifications()
  }, [isOpen, fetchNotifications])

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }

    // Navigate to relevant page
    const url = getNotificationUrl(notification, pathname)
    if (url) {
      setIsOpen(false)
      router.push(url)
    }
  }

  const handleMarkAsRead = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    await markAsRead(notificationId)
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  const handleMarkAllAsRead = async () => {
    setIsLoading(true)
    await markAllAsRead(userId)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    setIsLoading(false)
  }

  const handleDelete = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    const notification = notifications.find((n) => n.id === notificationId)
    await deleteNotification(notificationId)
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
    if (notification && !notification.read) {
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }
  }

  const getTypeColor = (type: Notification["type"]) => {
    switch (type) {
      case "invitation_received":
        return "bg-blue-500"
      case "invitation_accepted":
      case "registration_success":
      case "payment_success":
        return "bg-green-500"
      case "invitation_rejected":
      case "payment_failed":
        return "bg-red-500"
      case "race_reminder":
        return "bg-amber-500"
      case "team_update":
        return "bg-purple-500"
      default:
        return "bg-gray-400"
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative cursor-pointer">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={isLoading}
              className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="h-[320px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-10 text-center px-4">
              <Bell className="h-9 w-9 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const hasLink = !!getNotificationUrl(notification, pathname)
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "px-4 py-3 transition-colors group relative",
                      !notification.read && "bg-red-50/60",
                      hasLink
                        ? "cursor-pointer hover:bg-muted/60"
                        : "hover:bg-muted/40"
                    )}
                  >
                    <div className="flex gap-3">
                      {/* Colour dot */}
                      <div className="flex-shrink-0 mt-1.5">
                        <span
                          className={cn(
                            "block h-2 w-2 rounded-full",
                            notification.read
                              ? "bg-gray-300"
                              : getTypeColor(notification.type)
                          )}
                        />
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0 pr-6">
                        <p
                          className={cn(
                            "text-sm text-foreground line-clamp-1",
                            !notification.read && "font-semibold"
                          )}
                        >
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {formatTime(notification.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* Hover actions */}
                    <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-green-600"
                          title="Mark as read"
                          onClick={(e) => handleMarkAsRead(e, notification.id)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-red-500"
                        title="Delete"
                        onClick={(e) => handleDelete(e, notification.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t bg-muted/20">
            <p className="text-xs text-muted-foreground text-center">
              Showing last {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
