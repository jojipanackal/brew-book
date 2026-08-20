import { cn } from "#/lib/utils";

export function Spinner({ className }: { className?: string }) {
	return (
		<output
			aria-label="Loading"
			className={cn(
				"size-10 animate-spin rounded-full border-2 border-[var(--c-border)] border-t-[var(--c-brand)]",
				className,
			)}
		/>
	);
}
