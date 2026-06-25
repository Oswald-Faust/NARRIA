import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold font-body",
  {
    variants: {
      tone: {
        purple: "bg-purple/20 text-soft-purple",
        pink: "bg-pink/20 text-soft-pink",
        yellow: "bg-yellow/20 text-yellow",
        neutral: "bg-surface-2 text-muted",
        success: "bg-emerald-500/15 text-emerald-300",
        danger: "bg-red-500/15 text-red-300",
      },
    },
    defaultVariants: { tone: "purple" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
