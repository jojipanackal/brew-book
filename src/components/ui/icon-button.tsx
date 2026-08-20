import type { ComponentProps } from "react";
import { cn } from "#/lib/utils";

export function IconButton({ className, ...props }: ComponentProps<"button">) {
	return (
		<button
			type="button"
			className={cn(
				"grid size-9 place-items-center rounded-lg text-[var(--c-text-muted)] transition hover:bg-[var(--c-muted)] hover:text-[var(--c-text-mid)] disabled:opacity-30",
				className,
			)}
			{...props}
		/>
	);
}
