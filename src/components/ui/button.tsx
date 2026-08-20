import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "#/lib/utils.ts";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-45",
	{
		variants: {
			variant: {
				default: "bg-[var(--c-brand)] text-white hover:bg-[var(--c-text-mid)]",
				primary: "bg-[var(--c-brand)] text-white hover:bg-[var(--c-text-mid)]",
				secondary:
					"border border-[var(--c-border)] bg-transparent text-[var(--c-text-mid)] hover:bg-[var(--c-muted)]",
				outline:
					"border border-[var(--c-border-2)] bg-transparent text-[var(--c-text-soft)] hover:border-[var(--c-border-3)]",
				ghost:
					"text-[var(--c-text-muted)] hover:bg-[var(--c-muted)] hover:text-[var(--c-text-mid)]",
				destructive:
					"border border-[var(--c-border)] bg-transparent text-[var(--c-text-err)] hover:bg-[var(--c-err-bg)]",
				danger:
					"border border-[var(--c-border)] bg-transparent text-[var(--c-text-err)] hover:bg-[var(--c-err-bg)]",
				cream:
					"bg-[var(--c-cream)] text-[var(--c-brand)] shadow-[0_12px_30px_rgba(38,24,16,0.22)] hover:bg-white",
				green: "rounded-lg bg-green-500 text-white hover:bg-green-600",
			},
			size: {
				default: "min-h-11 px-4",
				sm: "min-h-9 rounded-lg px-3 py-2 text-xs",
				lg: "min-h-12 px-5 text-base",
				icon: "size-9 rounded-lg p-0",
				pill: "rounded-full px-8 py-3",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	fullWidth = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
		fullWidth?: boolean;
	}) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(
				buttonVariants({ variant, size, className }),
				fullWidth && "w-full",
			)}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
