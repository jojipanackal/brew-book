import type { ReactNode } from "react";
import { Badge, SwitchField } from "#/components/ui";

export function MetaTag({
	children,
	muted = false,
}: {
	children: ReactNode;
	muted?: boolean;
}) {
	return <Badge variant={muted ? "muted" : "default"}>{children}</Badge>;
}

export function PageHeader({
	eyebrow,
	title,
	action,
}: {
	eyebrow: string;
	title: string;
	action?: string;
}) {
	return (
		<div className="flex items-end justify-between gap-4 border-b border-[var(--c-border)] pb-4">
			<div>
				<p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--c-brand-lt)]">
					{eyebrow}
				</p>
				<h1 className="mt-1 font-serif text-3xl tracking-[-0.03em] text-[var(--c-text-dark)] sm:text-4xl">
					{title}
				</h1>
			</div>
			{action && (
				<span className="shrink-0 text-xs font-semibold text-[var(--c-text-dim)]">
					{action}
				</span>
			)}
		</div>
	);
}

export function SugarToggle({
	sugar,
	onChange,
	compact = false,
	disabled = false,
}: {
	sugar: boolean;
	onChange: (sugar: boolean) => void;
	compact?: boolean;
	disabled?: boolean;
}) {
	return (
		<SwitchField
			label="Sugar Free"
			description={!compact ? (sugar ? "Off" : "On") : undefined}
			checked={!sugar}
			onChange={(sugarFree) => onChange(!sugarFree)}
			disabled={disabled}
			compact={compact}
		/>
	);
}
