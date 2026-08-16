import { Coffee, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { drinks, getStats } from "#/lib/drinks";
import { brewingMessages, drinkColors, healthAdvice } from "../constants";
import { cx, pickRandom } from "../utils";
import { PageHeader } from "./common";
export function StatsView() {
	const [stats, setStats] = useState<
		import("#/routes/api/stats").StatsResponse | null
	>(null);
	const [fetching, setFetching] = useState(true);
	const [range, setRange] = useState(30);

	useEffect(() => {
		setFetching(true);
		void getStats(range)
			.then(setStats)
			.finally(() => setFetching(false));
	}, [range]);

	if (fetching && !stats)
		return (
			<div className="grid min-h-[50svh] place-items-center">
				<div className="flex flex-col items-center gap-3">
					<output
						aria-label="Loading"
						className="size-10 animate-spin rounded-full border-2 border-[var(--c-border)] border-t-[var(--c-brand)]"
					/>
					<p className="text-sm text-[var(--c-text-muted)]">
						{pickRandom(brewingMessages)}
					</p>
				</div>
			</div>
		);
	if (!stats) return null;

	const topDrinks = drinks
		.filter((d) => d !== "No drink")
		.map((d) => ({ drink: d, count: stats.byDrink[d] ?? 0 }))
		.filter((d) => d.count > 0)
		.sort((a, b) => b.count - a.count);

	const maxCount = Math.max(...topDrinks.map((d) => d.count), 1);
	const mostCommon = topDrinks[0]?.drink;
	const advice = mostCommon ? (healthAdvice[mostCommon] ?? []) : [];

	return (
		<div className="grid gap-5">
			<PageHeader eyebrow="Your data" title="Stats" />

			{/* Range selector */}
			<div className="flex items-center gap-2">
				{([7, 30, 90] as const).map((d) => (
					<button
						key={d}
						type="button"
						onClick={() => setRange(d)}
						className={cx(
							"flex-1 rounded-xl border py-2 text-sm font-semibold transition",
							range === d
								? "border-[var(--c-brand)] bg-[var(--c-brand)] text-white"
								: "border-[var(--c-border)] text-[var(--c-text-muted)] hover:bg-[var(--c-muted)]",
						)}
					>
						{d}d
					</button>
				))}
				{fetching && (
					<Loader2
						size={16}
						className="shrink-0 animate-spin text-[var(--c-brand-lt)]"
					/>
				)}
			</div>

			{/* Summary cards */}
			<div className="grid grid-cols-3 gap-2">
				<div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] px-3 py-3 text-center">
					<p className="text-2xl font-bold text-[var(--c-brand)]">
						{stats.streak}
					</p>
					<p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--c-text-dim)]">
						Day streak
					</p>
				</div>
				<div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] px-3 py-3 text-center">
					<p className="text-2xl font-bold text-[var(--c-brand)]">
						{stats.totalDays}
					</p>
					<p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--c-text-dim)]">
						Days logged
					</p>
				</div>
				<div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] px-3 py-3 text-center">
					<p className="text-2xl font-bold text-[var(--c-brand)]">
						{stats.sugarRate}%
					</p>
					<p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--c-text-dim)]">
						With sugar
					</p>
				</div>
			</div>

			{/* Bar chart */}
			{topDrinks.length > 0 && (
				<section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] p-4">
					<h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--c-brand-lt)]">
						Drink breakdown
					</h3>
					<div className="grid gap-2.5">
						{topDrinks.map(({ drink, count }) => (
							<div key={drink}>
								<div className="mb-1 flex items-center justify-between text-xs font-semibold">
									<span className="text-[var(--c-text-mid)]">{drink}</span>
									<span className="text-[var(--c-text-dim)]">{count}×</span>
								</div>
								<div className="h-2 w-full overflow-hidden rounded-full bg-[var(--c-muted)]">
									<div
										className="h-full rounded-full transition-all duration-500"
										style={{
											width: `${Math.round((count / maxCount) * 100)}%`,
											background: drinkColors[drink] ?? "var(--c-brand)",
										}}
									/>
								</div>
							</div>
						))}
					</div>
				</section>
			)}

			{/* Morning vs Evening split */}
			{topDrinks.length > 0 && (
				<section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] p-4">
					<h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--c-brand-lt)]">
						Morning vs Evening
					</h3>
					<div className="grid grid-cols-2 gap-4">
						{(["morning", "evening"] as const).map((period) => {
							const periodCounts = stats.byPeriod[period];
							const top = drinks
								.map((d) => ({ drink: d, count: periodCounts[d] ?? 0 }))
								.filter((d) => d.count > 0)
								.sort((a, b) => b.count - a.count)
								.slice(0, 3);
							return (
								<div key={period}>
									<p className="mb-2 text-xs font-semibold capitalize text-[var(--c-text-muted)]">
										{period}
									</p>
									{top.map(({ drink, count }) => (
										<div
											key={drink}
											className="mb-1 flex items-center gap-2 text-xs"
										>
											<span
												className="size-2 shrink-0 rounded-full"
												style={{
													background: drinkColors[drink] ?? "var(--c-brand)",
												}}
											/>
											<span className="min-w-0 truncate text-[var(--c-text-mid)]">
												{drink}
											</span>
											<span className="ml-auto shrink-0 text-[var(--c-text-dim)]">
												{count}
											</span>
										</div>
									))}
								</div>
							);
						})}
					</div>
				</section>
			)}

			{/* Health advice */}
			{advice.length > 0 && (
				<section className="rounded-2xl border border-[var(--c-border-2)] bg-[var(--c-accent-bg)] p-4">
					<h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--c-brand-lt)]">
						Health tips · {mostCommon}
					</h3>
					<ul className="grid gap-2">
						{advice.map((tip) => (
							<li
								key={tip}
								className="flex items-start gap-2 text-sm text-[var(--c-text-mid)]"
							>
								<Coffee
									size={13}
									className="mt-0.5 shrink-0 text-[var(--c-brand-lt)]"
								/>
								{tip}
							</li>
						))}
					</ul>
				</section>
			)}

			{stats.totalDays === 0 && (
				<div className="rounded-2xl border border-dashed border-[var(--c-empty)] bg-[var(--c-card)] px-4 py-10 text-center text-sm text-[var(--c-text-muted)]">
					No data yet. Start logging your drinks!
				</div>
			)}
		</div>
	);
}
