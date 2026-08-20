import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "#/lib/utils.ts";

const bannerVariants = cva(
	"flex items-center gap-2 border-b px-4 py-2.5 text-xs font-semibold sm:px-5",
	{
		variants: {
			variant: {
				success: "border-green-200 bg-green-50 text-green-700",
				error: "border-red-200 bg-red-50 text-red-700",
			},
		},
		defaultVariants: {
			variant: "success",
		},
	},
);

const dotColor: Record<
	NonNullable<VariantProps<typeof bannerVariants>["variant"]>,
	string
> = {
	success: "bg-green-600",
	error: "bg-red-600",
};

function Banner({
	className,
	variant,
	dot = false,
	...props
}: React.ComponentProps<"div"> &
	VariantProps<typeof bannerVariants> & {
		dot?: boolean;
	}) {
	return (
		<div className={cn(bannerVariants({ variant }), className)} {...props}>
			{dot && (
				<span
					className={cn("size-1.5 rounded-full", variant && dotColor[variant])}
				/>
			)}
			{props.children}
		</div>
	);
}

export { Banner };
