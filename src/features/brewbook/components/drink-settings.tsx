import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui";
import { type Drink, drinks, type Period } from "#/lib/drinks";
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
		<section aria-label={`${period.label} default`} className="grid gap-4 py-3">
			<div className="flex items-center justify-between gap-4">
				<label htmlFor={`default-${period.id}`} className="text-sm">
					{period.label}
				</label>
				<Select
					value={selected}
					onValueChange={(value) => onSelect(value as Drink)}
				>
					<SelectTrigger
						id={`default-${period.id}`}
						className="w-auto min-w-40 min-h-11"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{drinks.map((drink) => (
							<SelectItem className="min-h-11 pr-9" value={drink} key={drink}>
								{drink}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<SugarToggle
				disabled={selected === "No drink"}
				sugar={sugar}
				onChange={onToggleSugar}
			/>
		</section>
	);
}
