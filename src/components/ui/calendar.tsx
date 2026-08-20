import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "#/lib/utils.ts";

const dayVariants = cva(
	"mx-auto flex size-8 items-center justify-center rounded-full text-xs font-semibold transition",
	{
		variants: {
			state: {
				default: "text-[var(--c-text)] hover:bg-[var(--c-muted)]",
				today: "bg-[var(--c-accent-bg)] text-[var(--c-brand)]",
				selected: "bg-[var(--c-brand)] text-white",
				disabled: "text-[var(--c-text-dim)] opacity-30",
			},
		},
		defaultVariants: {
			state: "default",
		},
	},
);

function CalendarDay({
	children,
	className,
	state,
	...props
}: React.ComponentProps<"button"> & VariantProps<typeof dayVariants>) {
	return (
		<button
			type="button"
			className={cn(dayVariants({ state }), className)}
			{...props}
		>
			{children}
		</button>
	);
}

export { CalendarDay };
