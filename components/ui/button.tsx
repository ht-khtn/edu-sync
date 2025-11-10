import * as React from 'react'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'ghost'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
    const variants: Record<string, string> = {
      default:
        'bg-primary text-white hover:bg-primary/90 focus:ring-primary/60',
      ghost: 'bg-transparent text-primary hover:bg-primary/5'
    }
    return (
      <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...props} />
    )
  }
)

Button.displayName = 'Button'

export default Button
