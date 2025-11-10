import * as React from 'react'

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const { className = '', ...rest } = props
  return (
    <input
      ref={ref}
      className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder:text-muted-400 focus:outline-none focus:ring-2 focus:ring-offset-2 ${className}`}
      {...rest}
    />
  )
})

Input.displayName = 'Input'

export default Input
