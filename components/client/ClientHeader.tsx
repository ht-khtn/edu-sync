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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, FileText, LogOut, LayoutDashboard } from "lucide-react";

interface ClientHeaderProps {
  user?: { id: string } | null;
  hasAdminAccess?: boolean;
}

function ClientHeaderComponent({ user, hasAdminAccess }: ClientHeaderProps) {
  const router = useRouter();

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
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      suppressHydrationWarning
    >
      <nav
        className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4"
        suppressHydrationWarning
      >
        <Link
          href="/client"
          className="text-lg font-semibold tracking-tight text-primary hover:text-primary/80 transition-colors"
        >
          EduSync
        </Link>

        <div className="flex items-center gap-3" suppressHydrationWarning>
          {user && (
            <>
              <Button asChild variant="ghost" size="sm" className="gap-2">
                <Link href="/client/leaderboard">
                  <Trophy className="h-4 w-4" />
                  Bảng xếp hạng
                </Link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {user.id.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link
                      href="/client/my-violations"
                      className="cursor-pointer"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Vi phạm của tôi
                    </Link>
                  </DropdownMenuItem>
                  {hasAdminAccess && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer">
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          Trang quản trị
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          {!user && (
            <Button asChild size="sm">
              <Link href="/login">Đăng nhập</Link>
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}

export const ClientHeader = React.memo(ClientHeaderComponent);
