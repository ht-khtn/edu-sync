import * as React from 'react'

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>

export function Label({ children, className = '', ...props }: React.PropsWithChildren<LabelProps>) {
  return (
    <label className={`block text-sm font-medium text-muted-foreground ${className}`} {...props}>
      {children}
    </label>
  )
}

export default Label
