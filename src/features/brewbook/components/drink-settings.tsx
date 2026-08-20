import { Check, Coffee } from "lucide-react";
import { Button, Card } from "#/components/ui";
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
		<Card className="p-4 sm:p-5">
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
					<Button
						key={drink}
						onClick={() => onSelect(drink)}
						type="button"
						variant="outline"
						fullWidth
						className={cx(
							"min-h-11 justify-between text-left",
							selected === drink
								? "border-[var(--c-brand-lt)] bg-[var(--c-accent-bg)] text-[var(--c-text-mid)]"
								: "",
						)}
					>
						{drink}
						{selected === drink && <Check size={15} />}
					</Button>
				))}
			</div>
		</Card>
	);
}
