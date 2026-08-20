"use client";

import { useId } from "react";

import { cn } from "#/lib/utils.ts";
import { Switch } from "./switch";

function SwitchField({
	label,
	description,
	checked,
	onChange,
	disabled = false,
	compact = false,
	className,
}: {
	label: React.ReactNode;
	description?: React.ReactNode;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	compact?: boolean;
	className?: string;
}) {
	const id = useId();
	return (
		<label
			htmlFor={id}
			className={cn(
				"cursor-pointer",
				compact
					? "flex shrink-0 items-center gap-2 text-xs font-semibold text-[var(--c-text-mid)]"
					: "mt-3 flex min-h-10 w-full items-center justify-between rounded-xl border border-[var(--c-border)] px-3 text-left transition hover:border-[var(--c-brand-lt)]",
				disabled && "cursor-not-allowed opacity-45",
				className,
			)}
		>
			<span className={cn("block", compact && "whitespace-nowrap")}>
				<span
					className={cn("block font-semibold", compact ? "text-xs" : "text-sm")}
				>
					{label}
				</span>
				{!compact && description && (
					<span className="block text-xs text-[var(--c-text-dim)]">
						{description}
					</span>
				)}
			</span>
			<Switch
				id={id}
				checked={checked}
				onChange={onChange}
				disabled={disabled}
			/>
		</label>
	);
}

export { SwitchField };
