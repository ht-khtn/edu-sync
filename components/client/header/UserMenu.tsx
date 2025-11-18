"use client";

import React, { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FileText, LogOut, LayoutDashboard, User } from "lucide-react";

interface UserMenuProps {
  user: { id: string };
  hasAdminAccess?: boolean;
}

function UserMenuComponent({ user, hasAdminAccess }: UserMenuProps) {
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

  const initials = user.id.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full hover:bg-muted"
        >
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-sm font-medium bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">Tài khoản</p>
            <p className="text-xs text-muted-foreground">
              {user.id.slice(0, 8)}...
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/client/profile" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Hồ sơ cá nhân
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/client/my-violations" className="cursor-pointer">
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
  );
}

export const UserMenu = React.memo(UserMenuComponent);
