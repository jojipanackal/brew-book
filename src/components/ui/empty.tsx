import type { ComponentProps } from "react";
import { cn } from "#/lib/utils";

export function Empty({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"rounded-2xl border border-dashed border-[var(--c-empty)] bg-[var(--c-card)] px-4 py-8 text-center text-sm text-[var(--c-text-muted)]",
				className,
			)}
			{...props}
		/>
	);
}
