import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "#/lib/utils.ts";

const alertVariants = cva("rounded-xl border px-3 py-2 text-sm", {
	variants: {
		variant: {
			default:
				"border-[var(--c-border-err)] bg-[var(--c-err-bg)] text-[var(--c-text-err)]",
			error:
				"border-[var(--c-border-err)] bg-[var(--c-err-bg)] text-[var(--c-text-err)]",
			warning: "rounded-lg border-amber-200 bg-amber-50 text-amber-900",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

function Alert({
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div
			data-slot="alert"
			role="alert"
			className={cn(alertVariants({ variant }), className)}
			{...props}
		/>
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-title"
			className={cn("font-medium", className)}
			{...props}
		/>
	);
}

function AlertDescription({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-description"
			className={cn("text-sm opacity-90", className)}
			{...props}
		/>
	);
}

export { Alert, AlertDescription, AlertTitle };
