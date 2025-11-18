import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import React from "react";

interface EventCardProps {
  title: string;
  description: string;
  date: string;
  time?: string;
  location?: string;
  participants?: number;
  status?: "upcoming" | "ongoing" | "completed";
  className?: string;
  href?: string;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "ongoing":
      return { variant: "default" as const, label: "Đang diễn ra" };
    case "completed":
      return { variant: "secondary" as const, label: "Đã kết thúc" };
    default:
      return { variant: "outline" as const, label: "Sắp diễn ra" };
  }
};

const EventCard = React.memo<EventCardProps>(
  ({
    title,
    description,
    date,
    time,
    location,
    participants,
    status = "upcoming",
    className,
    href,
  }) => {
    const statusInfo = getStatusBadge(status);

    const content = (
      <Card
        className={cn(
          "hover:shadow-lg transition-all duration-300 group",
          className
        )}
      >
        <CardHeader>
          <div
            className="flex items-start justify-between gap-2"
            suppressHydrationWarning
          >
            <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
              {title}
            </CardTitle>
            <Badge variant={statusInfo.variant} className="shrink-0">
              {statusInfo.label}
            </Badge>
          </div>
          <CardDescription className="text-sm">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{new Date(date).toLocaleDateString("vi-VN")}</span>
              {time && <span className="text-xs">• {time}</span>}
            </div>
            {location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{location}</span>
              </div>
            )}
            {participants && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>{participants} người tham gia</span>
              </div>
            )}
          </div>
          {href && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between group-hover:bg-muted"
            >
              Xem chi tiết
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>
    );

    if (href) {
      return <Link href={href}>{content}</Link>;
    }

    return content;
  }
);

EventCard.displayName = "EventCard";

export { EventCard };
export type { EventCardProps };
