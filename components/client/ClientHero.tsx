import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ClientHeroProps {
  title?: string
  description?: string
  children?: ReactNode
  className?: string
}

export function ClientHero({ 
  title = "EduSync", 
  description = "Hệ thống hỗ trợ quản lý phong trào và thi đua dành cho học sinh THPT.",
  children,
  className
}: ClientHeroProps) {
  return (
    <section className={cn("border-b bg-gradient-to-b from-background to-muted/20", className)}>
      <div className="mx-auto max-w-6xl px-4 py-12 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {title}
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            {description}
          </p>
        </div>
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  )
}
