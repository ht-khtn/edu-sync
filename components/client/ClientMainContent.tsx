import { cn } from "@/lib/utils"

interface ClientMainContentProps {
  children: React.ReactNode
  className?: string
}

export function ClientMainContent({ children, className }: ClientMainContentProps) {
  return (
    <main className={cn("mx-auto max-w-6xl px-4 py-8", className)}>
      {children}
    </main>
  )
}
