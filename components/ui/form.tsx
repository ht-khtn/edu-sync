import * as React from "react";
import { Label as BaseLabel } from "./label";

type WithClassName = { className?: string };

export type FormProps = React.FormHTMLAttributes<HTMLFormElement> & {
  className?: string;
};

export function Form({ className = "", ...props }: FormProps) {
  return <form className={className} {...props} />;
}

export const FormItem = React.forwardRef<HTMLDivElement, React.PropsWithChildren<WithClassName>>(
  ({ className = "", children }, ref) => (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
);
FormItem.displayName = "FormItem";

export const FormControl = React.forwardRef<HTMLDivElement, React.PropsWithChildren<WithClassName>>(
  ({ className = "", children }, ref) => (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
);
FormControl.displayName = "FormControl";

export const FormLabel = React.forwardRef<
  HTMLLabelElement,
  React.ComponentPropsWithoutRef<typeof BaseLabel>
>(({ className = "", children, ...props }, ref) =>
  React.createElement(BaseLabel as any, { ref, className, ...props }, children)
);
FormLabel.displayName = "FormLabel";

export const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className = "", children, ...props }, ref) => (
  <p ref={ref} className={`text-xs text-red-600 ${className}`} {...props}>
    {children}
  </p>
));
FormMessage.displayName = "FormMessage";
