"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserMenu } from "../UserMenu";
import { Trophy, AlertCircle } from "lucide-react";

interface ClientHeaderProps {
  user?: { id: string } | null;
  hasAdminAccess?: boolean;
}

function ClientHeaderComponent({ user, hasAdminAccess }: ClientHeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60"
      suppressHydrationWarning
    >
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6"
        suppressHydrationWarning
      >
        <Link
          href="/client"
          className="flex items-center space-x-2 transition-opacity hover:opacity-80"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-lg font-bold">E</span>
          </div>
          <span className="text-xl font-bold tracking-tight">EduSync</span>
        </Link>

        <div className="flex items-center gap-2" suppressHydrationWarning>
          {user && (
            <>
              <Button asChild variant="ghost" size="sm" className="gap-2">
                <Link href="/client/leaderboard">
                  <Trophy className="h-4 w-4" />
                  Bảng xếp hạng
                </Link>
              </Button>

              <Button asChild variant="ghost" size="sm" className="gap-2">
                <Link href="/client/my-violations">
                  <AlertCircle className="h-4 w-4" />
                  Vi phạm của tôi
                </Link>
              </Button>

              <UserMenu user={user} hasAdminAccess={hasAdminAccess} />
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
