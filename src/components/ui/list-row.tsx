import type { ComponentProps } from "react";
import { cn } from "#/lib/utils";

export function ListRow({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"flex items-center justify-between gap-3 rounded-xl bg-[var(--c-row)] px-3 py-2.5",
				className,
			)}
			{...props}
		/>
	);
}
