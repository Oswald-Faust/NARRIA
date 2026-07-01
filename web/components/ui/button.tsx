import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Boutons « pill » du UI System NARR'IA.
 * - primary  : rose plein (CTA principal)
 * - purple   : violet plein
 * - secondary: gris doux
 * - outline  : bordure
 * - ghost    : transparent
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-body font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-foreground hover:bg-soft-pink",
        purple: "bg-primary text-primary-foreground hover:bg-purple/85",
        secondary: "bg-surface-2 text-foreground hover:bg-border",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-surface-2",
        ghost: "bg-transparent text-foreground hover:bg-surface-2",
      },
      size: {
        xs: "h-8 px-3.5 text-xs",
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-sm",
        lg: "h-13 px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
