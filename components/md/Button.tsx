import React, { type HTMLAttributes, type ReactNode } from 'react'

type ButtonProps = HTMLAttributes<HTMLElement> & {
  type?: 'button' | 'submit' | 'reset'
  children?: ReactNode
}

export function MdFilledButton({ children, type = 'button', ...rest }: ButtonProps) {
  return (
    // Use createElement form to avoid TSX intrinsic checks for custom element
    React.createElement('md-filled-button' as any, { type, ...rest }, children)
  )
}

export function MdOutlinedButton({ children, type = 'button', ...rest }: ButtonProps) {
  return (
    React.createElement('md-outlined-button' as any, { type, ...rest }, children)
  )
}

export default MdFilledButton
