import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "#/lib/utils.ts";

const badgeVariants = cva(
	"inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4",
	{
		variants: {
			variant: {
				default:
					"border-[var(--c-border-3)] bg-[var(--c-accent-bg)] text-[var(--c-text-mid)]",
				secondary:
					"border-[var(--c-border)] bg-[var(--c-card)] text-[var(--c-text-muted)]",
				muted:
					"border-[var(--c-border)] bg-[var(--c-card)] text-[var(--c-text-muted)]",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Badge({
	className,
	variant = "default",
	asChild = false,
	...props
}: React.ComponentProps<"span"> &
	VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot.Root : "span";

	return (
		<Comp
			data-slot="badge"
			data-variant={variant}
			className={cn(badgeVariants({ variant }), className)}
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
