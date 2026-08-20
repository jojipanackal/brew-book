import type * as React from "react";

import { cn } from "#/lib/utils.ts";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"h-10 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 text-sm text-[var(--c-text-dark)] outline-none transition focus:border-[var(--c-brand-lt)]",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
