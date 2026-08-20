"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "#/lib/utils.ts";

function Switch({
	className,
	onChange,
	onCheckedChange,
	...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
	onChange?: (checked: boolean) => void;
}) {
	const handleCheckedChange = (checked: boolean) => {
		onCheckedChange?.(checked);
		onChange?.(checked);
	};

	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			className={cn(
				"relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:bg-[var(--c-brand-lt)] data-[state=unchecked]:bg-[var(--c-toggle-off)]",
				className,
			)}
			onCheckedChange={handleCheckedChange}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className={cn(
					"pointer-events-none absolute left-1 top-1 block size-4 rounded-full bg-[var(--c-cream)] shadow transition",
					"data-[state=checked]:left-6 data-[state=unchecked]:left-1",
				)}
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
