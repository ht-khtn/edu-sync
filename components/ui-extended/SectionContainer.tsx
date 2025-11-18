import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionContainerProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function SectionContainer({
  children,
  className,
  title,
  description,
  action,
}: SectionContainerProps) {
  return (
    <section className={cn("space-y-6", className)} suppressHydrationWarning>
      {(title || description || action) && (
        <div
          className="flex items-start justify-between gap-4"
          suppressHydrationWarning
        >
          <div className="space-y-1" suppressHydrationWarning>
            {title && (
              <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div suppressHydrationWarning>{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
