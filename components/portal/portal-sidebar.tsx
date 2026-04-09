"use client";

import React, { useState } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Trophy,
  Calendar,
  UserPlus,
  CreditCard,
  Settings,
  FileText,
  BarChart3,
  Mail,
  Shield,
  Home,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import Image from "next/image";

export type UserRole = "runner" | "manager" | "admin" | "assistant_manager";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
}

// Helper function to get dashboard href by role
export function getDashboardHref(role: UserRole): string {
  switch (role) {
    case "runner":
      return "/runner/dashboard";
    case "manager":
      return "/manager/dashboard";
    case "admin":
      return "/admin/dashboard";
    case "assistant_manager":
      return "/assistant-manager/dashboard";
    default:
      return "/";
  }
}

const navigationItems: NavItem[] = [
  // Runner items
  {
    title: "Dashboard",
    href: "/runner/dashboard",
    icon: LayoutDashboard,
    roles: ["runner"],
  },
  {
    title: "Races",
    href: "/runner/races",
    icon: Trophy,
    roles: ["runner"],
  },
  { title: "My Team",      href: "/runner/teams",        icon: Users,           roles: ["runner"] },
  { title: "Explore Teams",href: "/runner/explore-teams",icon: UserPlus,        roles: ["runner"] },
  {
    title: "Invitations",
    href: "/runner/invitations",
    icon: Mail,
    roles: ["runner"],
  },
  {
    title: "Results",
    href: "/runner/results",
    icon: BarChart3,
    roles: ["runner"],
  },
  {
    title: "Settings",
    href: "/runner/settings",
    icon: Settings,
    roles: ["runner"],
  },
  // Manager items
  {
    title: "Dashboard",
    href: "/manager/dashboard",
    icon: LayoutDashboard,
    roles: ["manager"],
  },
  {
    title: "Races",
    href: "/manager/races",
    icon: Trophy,
    roles: ["manager"],
  },
  {
    title: "Team",
    href: "/manager/teams",
    icon: Users,
    roles: ["manager"],
  },
  {
    title: "Invitations",
    href: "/manager/invitations",
    icon: UserPlus,
    roles: ["manager"],
  },
  {
    title: "Registrations",
    href: "/manager/registrations",
    icon: FileText,
    roles: ["manager"],
  },
  {
    title: "Payments",
    href: "/manager/payments",
    icon: CreditCard,
    roles: ["manager"],
  },
  {
    title: "Settings",
    href: "/manager/settings",
    icon: Settings,
    roles: ["manager"],
  },
  // Assistant Manager items — same nav as manager
  {
    title: "Dashboard",
    href: "/manager/dashboard",
    icon: LayoutDashboard,
    roles: ["assistant_manager"],
  },
  {
    title: "Races",
    href: "/manager/races",
    icon: Trophy,
    roles: ["assistant_manager"],
  },
  {
    title: "Teams",
    href: "/manager/teams",
    icon: Users,
    roles: ["assistant_manager"],
  },
  {
    title: "Invitations",
    href: "/manager/invitations",
    icon: UserPlus,
    roles: ["assistant_manager"],
  },
  {
    title: "Registrations",
    href: "/manager/registrations",
    icon: FileText,
    roles: ["assistant_manager"],
  },
  {
    title: "Payments",
    href: "/manager/payments",
    icon: CreditCard,
    roles: ["assistant_manager"],
  },
  {
    title: "Settings",
    href: "/manager/settings",
    icon: Settings,
    roles: ["assistant_manager"],
  },
  // Admin items
  {
    title: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    roles: ["admin"],
  },
  {
    title: "Race Management",
    href: "/admin/races",
    icon: Trophy,
    roles: ["admin"],
  },
  {
    title: "Race Calendar",
    href: "/admin/calendar",
    icon: Calendar,
    roles: ["admin"],
  },
  {
    title: "Teams",
    href: "/admin/teams",
    icon: Users,
    roles: ["admin"],
  },
  {
    title: "All Users",
    href: "/admin/users",
    icon: Users,
    roles: ["admin"],
  },
  {
    title: "Registrations",
    href: "/admin/registrations",
    icon: FileText,
    roles: ["admin"],
  },
  {
    title: "Payments",
    href: "/admin/payments",
    icon: CreditCard,
    roles: ["admin"],
  },
  {
    title: "Reports",
    href: "/admin/reports",
    icon: BarChart3,
    roles: ["admin"],
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Shield,
    roles: ["admin"],
  },
];

interface PortalSidebarProps {
  role: UserRole;
}

export function PortalSidebar({ role }: PortalSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Filter navigation items based on role
  const filteredItems = navigationItems.filter((item) =>
    item.roles.includes(role),
  );

  // Group items by section
  const dashboardItems = filteredItems.filter(
    (item) => item.title === "Dashboard",
  );
  const mainItems = filteredItems.filter((item) => item.title !== "Dashboard");

  const getRoleLabel = () => {
    switch (role) {
      case "runner":
        return "Runner Menu";
      case "manager":
        return "Manager Menu";
      case "admin":
        return "Admin Menu";
      case "assistant_manager":
        return "Asst. Manager Menu";
      default:
        return "Navigation";
    }
  };

  const { toggleSidebar, open } = useSidebar();

  const handleLogout = async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <Sidebar collapsible="icon"  className="overflow-x-hidden">
      <SidebarHeader className=" mb-3">
        <div className="flex gap-5 items-center mt-2">
          <Link href="/admin/dashboard" className={` flex items-center gap-2`}>
            <div className="flex items-center gap-3 justify-center rounded-md  text-black font-bold ">
              {/* Logo */}
              <div className="flex h-10 p-1 w-10 items-center justify-center rounded-xl bg-[#FF0000] text-black font-bold text-sm">
                <Image
                  src="/white_red_irl_fav_icon__1_-removebg-preview.png"
                  width={80}
                  height={80}
                  alt="irl-logo"
                />
              </div>

              {/* Animated Text */}
              <div
                className={` flex  flex-col gap-0.5 leading-none overflow-hidden whitespace-nowrap transition-[opacity,transform] duration-300 ease-out ${open ? "opacity-100 translate-x-0 delay-100" : "opacity-0 -translate-x-1 pointer-events-none"}`}
              >
                <span className="font-semibold capitalize text-md">
                  Infinite Running League
                </span>
                <span className="text-xs text-muted-foreground  capitalize">{role} Portal</span>
              </div>
            </div>
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto ">
        {/* Dashboard Section */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {dashboardItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Main Navigation Section */}
        <SidebarGroup>
          <SidebarGroupLabel>{getRoleLabel()}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Portal switch for assistant managers */}
        {role === "assistant_manager" && (() => {
          const inRunnerPortal = pathname.startsWith("/runner")
          return (
            <>
              <SidebarSeparator />
              <SidebarGroup>
                <SidebarGroupContent className="overflow-x-hidden">
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        tooltip={inRunnerPortal ? "Switch to Manager Portal" : "Switch to Runner Portal"}
                      >
                        <Link href={inRunnerPortal ? "/manager/dashboard" : "/runner/dashboard"}>
                          {inRunnerPortal
                            ? <Users className="h-4 w-4" />
                            : <Home className="h-4 w-4" />
                          }
                          <span>{inRunnerPortal ? "Switch to Manager Portal" : "Switch to Runner Portal"}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="Portal Select">
                        <Link href="/portal-select">
                          <ChevronLeft className="h-4 w-4" />
                          <span>Portal Select</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          )
        })()}
      </SidebarContent>

      <SidebarFooter className=" p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip="Sign Out"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
