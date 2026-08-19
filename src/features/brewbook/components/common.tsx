import type { ReactNode } from "react";
import { cx } from "../utils";

export function MetaTag({
	children,
	muted = false,
}: {
	children: ReactNode;
	muted?: boolean;
}) {
	return (
		<span
			className={cx(
				"inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4",
				muted
					? "border-[var(--c-border)] bg-[var(--c-card)] text-[var(--c-text-muted)]"
					: "border-[var(--c-border-3)] bg-[var(--c-accent-bg)] text-[var(--c-text-mid)]",
			)}
		>
			{children}
		</span>
	);
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
		<button
			aria-label="Sugar Free"
			aria-pressed={!sugar}
			disabled={disabled}
			className={cx(
				compact
					? "flex shrink-0 items-center gap-2 text-xs font-semibold text-[var(--c-text-mid)]"
					: "mt-3 flex min-h-10 w-full items-center justify-between rounded-xl border border-[var(--c-border)] px-3 text-left transition hover:border-[var(--c-brand-lt)]",
				disabled && "cursor-not-allowed opacity-45",
			)}
			onClick={() => onChange(!sugar)}
			type="button"
		>
			<span className={cx(compact && "whitespace-nowrap")}>
				<span
					className={cx("block font-semibold", compact ? "text-xs" : "text-sm")}
				>
					Sugar Free
				</span>
				{!compact && (
					<span className="block text-xs text-[var(--c-text-dim)]">
						{sugar ? "Off" : "On"}
					</span>
				)}
			</span>
			<span
				className={cx(
					"relative h-6 w-11 rounded-full transition",
					sugar ? "bg-[var(--c-toggle-off)]" : "bg-[var(--c-brand-lt)]",
				)}
			>
				<span
					className={cx(
						"absolute top-1 size-4 rounded-full bg-white transition",
						sugar ? "left-1" : "left-6",
					)}
				/>
			</span>
		</button>
	);
}
