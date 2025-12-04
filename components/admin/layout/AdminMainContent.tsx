import { cn } from "@/lib/utils";

interface AdminMainContentProps {
  children: React.ReactNode;
  className?: string;
}

export function AdminMainContent({
  children,
  className,
}: AdminMainContentProps) {
  return (
    <main
      className={cn("flex-1 overflow-y-auto p-6", className)}
      suppressHydrationWarning
    >
      <div className="mx-auto max-w-7xl" suppressHydrationWarning>
        {children}
      </div>
    </main>
  );
}
