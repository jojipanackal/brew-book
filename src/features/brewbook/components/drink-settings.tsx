import { Check, Coffee } from "lucide-react";
import { type Drink, drinks, type Period } from "#/lib/drinks";
import { cx } from "../utils";
import { SugarToggle } from "./common";
export function DefaultDrinkSetting({
	period,
	selected,
	sugar,
	onSelect,
	onToggleSugar,
}: {
	period: { id: Period; label: string; helper: string };
	selected: Drink;
	sugar: boolean;
	onSelect: (drink: Drink) => void;
	onToggleSugar: (sugar: boolean) => void;
}) {
	return (
		<section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] p-4 shadow-[0_8px_30px_rgba(77,57,38,0.04)] sm:p-5">
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-start gap-3">
					<span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--c-muted)] text-[var(--c-brand-lt)]">
						<Coffee size={17} />
					</span>
					<h2 className="pt-1 text-sm font-semibold text-[var(--c-text-dark)]">
						{period.label}
					</h2>
				</div>
				<SugarToggle
					compact
					disabled={selected === "No drink"}
					sugar={sugar}
					onChange={onToggleSugar}
				/>
			</div>
			<div className="mt-4 grid grid-cols-1 gap-2">
				{drinks.map((drink) => (
					<button
						key={drink}
						onClick={() => onSelect(drink)}
						type="button"
						className={cx(
							"flex min-h-11 items-center justify-between rounded-xl border px-3 text-left text-sm font-semibold transition",
							selected === drink
								? "border-[var(--c-brand-lt)] bg-[var(--c-accent-bg)] text-[var(--c-text-mid)]"
								: "border-[var(--c-border-2)] text-[var(--c-text-soft)] hover:border-[var(--c-border-3)]",
						)}
					>
						{drink}
						{selected === drink && <Check size={15} />}
					</button>
				))}
			</div>
		</section>
	);
}
