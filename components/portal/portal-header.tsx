"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Settings,
  LogOut,
  User,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/notification-bell";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  type UserRole,
  getDashboardHref,
} from "@/components/portal/portal-sidebar";
import { Input } from "../ui/input";
import { useSidebar } from "../ui/sidebar";

interface PortalHeaderProps {
  portalTitle: string;
  role: UserRole;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  } | null;
}

// Pages per role that actually consume ?q= and do live filtering
const SEARCHABLE_PAGES: Record<string, string[]> = {
  admin:             ["users", "teams", "races", "registrations", "payments"],
  manager:           ["teams", "races"],
  assistant_manager: ["teams", "races"],
  runner:            ["races"],
};

export function PortalHeader({ portalTitle, role, user }: PortalHeaderProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync field with URL param (back/forward navigation)
  const [searchValue, setSearchValue] = useState(searchParams.get("q") ?? "");
  useEffect(() => {
    setSearchValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  // Which searchable pages exist for this role
  const pages = SEARCHABLE_PAGES[role] ?? [];

  // Are we already on a page that reacts to ?q= ?
  const isOnSearchablePage = pages.some((p) => pathname.includes(`/${p}`));

  // If on a searchable page, keep it; otherwise jump to the first one (e.g. teams for manager)
  const getTargetPath = () =>
    isOnSearchablePage ? pathname : `/${role}/${pages[0] ?? "dashboard"}`;

  const commitSearch = (value: string) => {
    const target = getTargetPath();
    if (value.trim()) {
      router.push(`${target}?q=${encodeURIComponent(value.trim())}`);
    } else {
      router.push(target);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (!searchValue.trim()) return;
      commitSearch(searchValue);
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setSearchValue("");
      if (isOnSearchablePage) router.push(pathname); // strip ?q= from current page
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    setSearchValue("");
    if (isOnSearchablePage) router.push(pathname);
    inputRef.current?.focus();
  };

  const initials = user
    ? `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`.toUpperCase() ||
      user.email.charAt(0).toUpperCase()
    : "U";

  const displayName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email
    : "User";

  const handleLogout = async () => {
    setIsLoggingOut(true);
    toast({ title: "Signing out...", description: "Please wait while we sign you out." });
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      if (typeof window !== "undefined") {
        localStorage.removeItem("sidebar-state");
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("sb-") || key.includes("supabase"))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
        sessionStorage.clear();
      }
      toast({ title: "Signed out", description: "You have been successfully signed out." });
      window.location.href = "/auth/login";
    } catch (error) {
      console.error("Sign out error:", error);
      toast({ title: "Error", description: "Failed to sign out. Please try again.", variant: "destructive" });
      setIsLoggingOut(false);
    }
  };

  const { toggleSidebar, open } = useSidebar();

  return (
    <header className="sticky top-0 z-10 w-full bg-[oklch(93.564%_0.03087_17.529)]">
      <div className="flex h-14 items-center justify-between pt-3 px-4 md:px-6">
        {/* Left — sidebar toggle */}
        <div className="flex justify-center">
          <button
            onClick={toggleSidebar}
            className="mr-2 hidden lg:flex items-center justify-center h-8 w-8 rounded-lg border border-border bg-white/60 backdrop-blur-sm hover:bg-white hover:shadow-sm transition-all duration-200 cursor-pointer"
            title={open ? "Collapse sidebar" : "Expand sidebar"}
          >
            {open
              ? <ChevronLeft className="h-4 w-4 text-gray-600" />
              : <ChevronRight className="h-4 w-4 text-gray-600" />
            }
          </button>
        </div>

        {/* Centre — search bar */}
        <div className="flex items-center gap-3 flex-1 mx-2 md:mx-4">
          <div className="relative w-full max-w-xs sm:max-w-sm lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-gray-500 h-4 w-4 pointer-events-none" />
            <Input
              ref={inputRef}
              placeholder={
                isOnSearchablePage
                  ? "Search..."
                  : pages.length > 0
                  ? `Search ${pages[0]}...`
                  : "Search..."
              }
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9 pr-8 h-8 w-full border text-black bg-white/60 backdrop-blur-lg border-gray-300/50 placeholder:text-gray-500 rounded-lg focus:bg-white/90 transition-colors"
            />
            {searchValue && (
              <button
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right — notifications + user */}
        <div className="flex items-center gap-2">
          {user && <NotificationBell userId={user.id} />}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2 hover:bg-muted cursor-pointer">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-gray-500 dark:bg-gray-300 text-primary-foreground text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm capitalize font-medium text-foreground md:inline-block truncate">
                  {displayName}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none mt-2">{displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground mt-1">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/${role}/settings`} className="flex items-center cursor-pointer">
                  <Settings className="mr-2 h-4 w-4 hover:text-white" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={getDashboardHref(role)} className="flex items-center cursor-pointer">
                  <User className="mr-2 h-4 w-4 hover:text-white" />
                  Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={isLoggingOut}
                className=" text-red-600 cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4 hover:text-white" />
                {isLoggingOut ? "Signing out..." : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
