import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

interface AnnouncementCardProps {
  title: string;
  content: string;
  date: string;
  type?: "info" | "warning" | "success" | "urgent";
  category?: string;
  className?: string;
}

const getBadgeVariant = (type: string) => {
  switch (type) {
    case "urgent":
    case "warning":
      return "destructive";
    case "success":
      return "default";
    default:
      return "secondary";
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case "urgent":
      return "Khẩn cấp";
    case "warning":
      return "Lưu ý";
    case "success":
      return "Sự kiện";
    default:
      return "Thông tin";
  }
};

const AnnouncementCard = React.memo<AnnouncementCardProps>(
  ({ title, content, date, type = "info", category, className }) => {
    return (
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
            <Badge variant={getBadgeVariant(type)} className="shrink-0">
              {getTypeLabel(type)}
            </Badge>
          </div>
          <CardDescription className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(date).toLocaleDateString("vi-VN")}
            </span>
            {category && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {category}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {content}
          </p>
        </CardContent>
      </Card>
    );
  }
);

AnnouncementCard.displayName = "AnnouncementCard";

export { AnnouncementCard };
export type { AnnouncementCardProps };
