import * as React from 'react'

export function Card({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <section className={`rounded-lg border bg-card p-4 ${className}`}>
      {children}
    </section>
  )
}

export function CardHeader({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
  return <header className={`mb-2 ${className}`}>{children}</header>
}

export function CardTitle({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
  return <h3 className={`text-lg font-semibold ${className}`}>{children}</h3>
}

export function CardContent({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`mt-2 ${className}`}>{children}</div>
}

export default Card
