import {
	CheckCircle2,
	Coffee,
	Leaf,
	LoaderCircle,
	Sparkles,
	Users,
} from "lucide-react";

import type { Drink, PollRecord } from "#/lib/drinks";
import { getBrewSummary } from "#/lib/polls";

const drinkGlyphs: Record<Drink, { label: string; className: string }> = {
	Tea: { label: "T", className: "bg-[#f6dfb5] text-[#76511f]" },
	Coffee: { label: "C", className: "bg-[#d9b58c] text-[#57331d]" },
	"Green tea": { label: "G", className: "bg-[#dfe9c9] text-[#48602d]" },
	Milk: { label: "M", className: "bg-[#edf0f2] text-[#53606a]" },
	"Black Coffee": { label: "BC", className: "bg-[#4b3429] text-[#fff8ed]" },
	"Black Tea": { label: "BT", className: "bg-[#71503b] text-[#fff8ed]" },
	"No drink": { label: "—", className: "bg-[#eee9e1] text-[#847a70]" },
};

function initials(name: string) {
	return name
		.trim()
		.split(/\s+/)
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

export function DrinkGlyph({
	drink,
	className = "size-9",
}: {
	drink: Drink;
	className?: string;
}) {
	const glyph = drinkGlyphs[drink];
	return (
		<span
			aria-hidden="true"
			className={`grid shrink-0 place-items-center rounded-xl text-[10px] font-bold tracking-[-0.02em] ${glyph.className} ${className}`}
		>
			{glyph.label}
		</span>
	);
}

export function SaveStatus({ state }: { state?: "saving" | "saved" }) {
	if (!state) return null;
	return (
		<span
			aria-live="polite"
			className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#7d7267]"
		>
			{state === "saving" ? (
				<LoaderCircle className="animate-spin" size={13} />
			) : (
				<CheckCircle2 className="text-[#4d7a4e]" size={13} />
			)}
			{state === "saving" ? "Saving" : "Saved"}
		</span>
	);
}

export function BrewSummary({
	polls,
	userName,
}: {
	polls: PollRecord[];
	userName: string;
}) {
	const summary = getBrewSummary(polls);
	const firstName = userName.trim().split(/\s+/)[0] || "there";
	const visiblePeople = polls.slice(0, 5);

	return (
		<section className="relative overflow-hidden rounded-[28px] bg-[#493225] p-5 text-[#fffaf2] shadow-[0_24px_60px_rgba(64,41,27,0.18)] sm:p-7">
			<div
				aria-hidden="true"
				className="absolute -right-24 -top-28 size-72 rounded-full bg-[#c98d58]/30 blur-3xl"
			/>
			<div
				aria-hidden="true"
				className="absolute -bottom-36 left-1/3 size-64 rounded-full bg-[#82976b]/20 blur-3xl"
			/>
			<div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
				<div>
					<p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#e8c9a8]">
						<Sparkles size={14} />
						Live brew board
					</p>
					<h2 className="mt-3 max-w-xl font-serif text-3xl leading-[1.08] tracking-[-0.04em] sm:text-4xl">
						Here’s the pour, {firstName}.
					</h2>
					<p className="mt-3 max-w-lg text-sm leading-6 text-[#e9ddd2]">
						Your team’s full order is already taking shape. Pick yours and the
						kitchen count updates instantly.
					</p>
					<div className="mt-6 flex items-center gap-3">
						<div className="flex -space-x-2">
							{visiblePeople.map((poll) => (
								<span
									className="grid size-8 place-items-center rounded-full border-2 border-[#493225] bg-[#f2dfc8] text-[10px] font-bold text-[#593b28]"
									key={poll.user.id ?? poll.user.email}
									title={poll.user.name}
								>
									{initials(poll.user.name)}
								</span>
							))}
						</div>
						<span className="text-xs font-semibold text-[#dac7b7]">
							{summary.people
								? `${summary.people} ${summary.people === 1 ? "person" : "people"} checked in`
								: "Be the first to check in"}
						</span>
					</div>
				</div>
				<div className="grid grid-cols-3 gap-2.5">
					<SummaryMetric
						icon={<Coffee size={16} />}
						label="Cups"
						value={String(summary.cups)}
					/>
					<SummaryMetric
						icon={<Leaf size={16} />}
						label="Sugar-free"
						value={String(summary.sugarFreeCups)}
					/>
					<SummaryMetric
						icon={<Users size={16} />}
						label="Top pick"
						value={summary.topDrink?.drink ?? "—"}
						compact
					/>
				</div>
			</div>
		</section>
	);
}

function SummaryMetric({
	icon,
	label,
	value,
	compact = false,
}: {
	icon: React.ReactNode;
	label: string;
	value: string;
	compact?: boolean;
}) {
	return (
		<div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.08] p-3 backdrop-blur">
			<span className="text-[#e8c9a8]">{icon}</span>
			<strong
				className={`mt-3 block truncate font-serif leading-none ${
					compact ? "text-sm sm:text-base" : "text-2xl"
				}`}
				title={value}
			>
				{value}
			</strong>
			<span className="mt-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-[#cdbbad] sm:text-[10px]">
				{label}
			</span>
		</div>
	);
}
