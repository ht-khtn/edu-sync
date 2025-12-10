"use client";

import React, { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { User, LogOut } from "lucide-react";
import NotificationsBell from "@/components/common/NotificationsBell";
import { useUser } from "@/hooks/useUser";

function AdminHeaderComponent() {
  const router = useRouter();
  const { user } = useUser();

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }, [router]);

  return (
    <header
      className="sticky top-0 z-50 w-full  bg-transparent"
      suppressHydrationWarning
    >
      <div
        className="flex h-16 items-center gap-4 px-6"
        suppressHydrationWarning
      >
        <SidebarTrigger />
        <div className="flex-1" suppressHydrationWarning />
        <nav className="flex items-center gap-2">
          <NotificationsBell />
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="User menu">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/client/my-violations">My Violations</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/client">Client View</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!user && (
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Login</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

export const AdminHeader = React.memo(AdminHeaderComponent);
