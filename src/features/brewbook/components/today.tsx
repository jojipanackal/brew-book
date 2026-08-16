import {
	CalendarOff,
	Check,
	ChevronDown,
	Coffee,
	Eye,
	Info,
	Loader2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	type AttendanceStatus,
	type Drink,
	type DrinkChoice,
	drinks,
	type Period,
	type PollRecord,
	periods,
	type SugarChoice,
} from "#/lib/drinks";
import { periodDetails, todayKey } from "../constants";
import { countChoices, cx, displayDate } from "../utils";
import { PageHeader, SugarToggle } from "./common";
import { DrinkInfoSheet } from "./overlays";
export function TodayView({
	entry,
	sugar,
	todayPolls,
	updateEntry,
	updateSugar,
	onOpen,
	guest = false,
	availability = { morning: "office", evening: "office" },
	onUpdateAvailability,
	availabilityLoading = null,
	pianoMode = false,
}: {
	entry: DrinkChoice;
	sugar: SugarChoice;
	todayPolls: PollRecord[];
	updateEntry: (period: Period, drink: Drink) => void;
	updateSugar: (period: Period, sugar: boolean) => void;
	onOpen: (period: Period) => void;
	guest?: boolean;
	availability?: Record<Period, AttendanceStatus>;
	onUpdateAvailability?: (period: Period, status: AttendanceStatus) => void;
	availabilityLoading?: Period | null;
	pianoMode?: boolean;
}) {
	// IST time for cutoff checks
	const [nowIST, setNowIST] = useState(() => {
		const d = new Date();
		const [h, m] = new Intl.DateTimeFormat("en-IN", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
			timeZone: "Asia/Kolkata",
		})
			.format(d)
			.split(":")
			.map(Number);
		return h * 60 + m;
	});
	useEffect(() => {
		const id = setInterval(() => {
			const d = new Date();
			const [h, m] = new Intl.DateTimeFormat("en-IN", {
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
				timeZone: "Asia/Kolkata",
			})
				.format(d)
				.split(":")
				.map(Number);
			setNowIST(h * 60 + m);
		}, 30_000);
		return () => clearInterval(id);
	}, []);

	const morningClosed = nowIST >= 11 * 60;
	const eveningClosed = nowIST >= 15 * 60 + 15;

	const isPeriodClosed = (id: Period) =>
		id === "morning" ? morningClosed : eveningClosed;

	// Twinkle Twinkle Little Star — C C G G A A G, F F E E D D C, ...
	const TWINKLE = [
		261.63, 261.63, 392.0, 392.0, 440.0, 440.0, 392.0, 349.23, 349.23, 329.63,
		329.63, 293.66, 293.66, 261.63,
	];
	const pianoNoteIdx = useRef(0);
	const audioCtxRef = useRef<AudioContext | null>(null);
	function playPianoNote() {
		if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
		const ctx = audioCtxRef.current;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.type = "triangle";
		osc.frequency.value = TWINKLE[pianoNoteIdx.current % TWINKLE.length];
		pianoNoteIdx.current += 1;
		gain.gain.setValueAtTime(0.5, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
		osc.start(ctx.currentTime);
		osc.stop(ctx.currentTime + 0.5);
	}

	function pianoSelect(period: Period, drink: Drink) {
		playPianoNote();
		updateEntry(period, drink);
	}

	return (
		<div className="grid gap-5">
			<PageHeader
				eyebrow={displayDate(todayKey)}
				title={pianoMode ? "🎹 Piano Mode" : "Today"}
				action={pianoMode ? "tap to play" : `${todayPolls.length} people`}
			/>
			{!guest && (
				<AvailabilityControl
					availability={availability}
					loading={availabilityLoading}
					nowIST={nowIST}
					onChange={onUpdateAvailability}
				/>
			)}
			<div className="grid gap-3">
				{(nowIST >= 12 * 60 ? [...periodDetails].reverse() : periodDetails).map(
					(period) => (
						<div key={period.id} className="grid gap-0">
							<DrinkPoll
								period={period}
								closed={isPeriodClosed(period.id)}
								polls={todayPolls}
								selected={entry[period.id]}
								sugar={sugar[period.id]}
								editable={
									!isPeriodClosed(period.id) &&
									availability[period.id] === "office"
								}
								onSelect={
									isPeriodClosed(period.id)
										? undefined
										: (drink) =>
												pianoMode
													? pianoSelect(period.id, drink)
													: updateEntry(period.id, drink)
								}
								onToggleSugar={
									isPeriodClosed(period.id)
										? undefined
										: (next) => updateSugar(period.id, next)
								}
								onOpen={() => onOpen(period.id)}
							/>
						</div>
					),
				)}
			</div>
		</div>
	);
}
function AvailabilityControl({
	availability,
	loading,
	nowIST,
	onChange,
}: {
	availability: Record<Period, AttendanceStatus>;
	loading: Period | null;
	nowIST: number;
	onChange?: (period: Period, status: AttendanceStatus) => void;
}) {
	const labels: Record<AttendanceStatus, string> = {
		office: "In office",
		wfh: "Working from home",
		leave: "On leave",
	};
	const visiblePeriods = periods.filter((period) =>
		period === "morning" ? nowIST < 11 * 60 : nowIST < 15 * 60 + 15,
	);
	if (visiblePeriods.length === 0) return null;
	return (
		<details className="group rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] px-4 py-3 shadow-[0_8px_30px_rgba(77,57,38,0.03)]">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[var(--c-text-mid)]">
				<span className="flex items-center gap-2.5">
					<CalendarOff size={17} className="text-[var(--c-brand-lt)]" />
					Mark your absence
				</span>
				<ChevronDown
					size={17}
					className="text-[var(--c-text-muted)] transition-transform group-open:rotate-180"
				/>
			</summary>
			<div className="mt-3 grid gap-3 border-t border-[var(--c-border-2)] pt-3 sm:grid-cols-2">
				{visiblePeriods.map((period) => (
					<label
						key={period}
						className="grid gap-1.5 text-xs font-semibold text-[var(--c-text-muted)]"
					>
						<span>{period === "morning" ? "Morning" : "Evening"}</span>
						<select
							className="h-10 rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-2 text-sm font-semibold text-[var(--c-text-mid)]"
							disabled={loading !== null}
							value={availability[period]}
							onChange={(event) =>
								onChange?.(period, event.target.value as AttendanceStatus)
							}
						>
							{(Object.keys(labels) as AttendanceStatus[]).map((status) => (
								<option key={status} value={status}>
									{labels[status]}
								</option>
							))}
						</select>
						{loading === period && (
							<Loader2
								size={14}
								className="animate-spin text-[var(--c-brand-lt)]"
							/>
						)}
					</label>
				))}
			</div>
		</details>
	);
}
function DrinkPoll({
	period,
	closed = false,
	polls,
	selected,
	sugar,
	editable,
	onSelect,
	onToggleSugar,
	onOpen,
}: {
	period: { id: Period; label: string; helper: string };
	closed?: boolean;
	polls: PollRecord[];
	selected?: Drink;
	sugar: boolean;
	editable: boolean;
	onSelect?: (drink: Drink) => void;
	onToggleSugar?: (sugar: boolean) => void;
	onOpen?: () => void;
}) {
	const activePolls = polls.filter(
		(entry) => entry.availability[period.id] === "office",
	);
	const counts = countChoices(activePolls.map((entry) => entry.choices))[
		period.id
	];
	const unavailableCount = polls.length - activePolls.length;
	const total = activePolls.length;
	const [infoDrink, setInfoDrink] = useState<Drink | null>(null);
	return (
		<div className="overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] shadow-[0_8px_30px_rgba(77,57,38,0.04)]">
			<div className="flex items-center justify-between gap-4 border-b border-[var(--c-border-2)] px-4 py-3.5 sm:px-5">
				<span className="flex items-center gap-2.5">
					<span className="grid size-8 place-items-center rounded-lg bg-[var(--c-muted)] text-[var(--c-brand-lt)]">
						<Coffee size={16} />
					</span>
					<span>
						<span className="block text-sm font-semibold text-[var(--c-text-dark)]">
							{period.label}
						</span>
						<span className="block text-xs text-[var(--c-text-dim)]">
							{total} {total === 1 ? "response" : "responses"}
							{unavailableCount ? ` · ${unavailableCount} away` : ""}
						</span>
					</span>
				</span>
				<SugarToggle
					compact
					disabled={closed || selected === "No drink"}
					sugar={sugar}
					onChange={onToggleSugar ?? (() => undefined)}
				/>
			</div>
			{closed && (
				<div className="flex items-center gap-2 border-b border-[var(--c-border-2)] bg-[var(--c-muted)] px-4 py-2.5 text-xs font-semibold text-[var(--c-text-muted)] sm:px-5">
					<span className="size-1.5 rounded-full bg-[var(--c-brand-lt)]" />
					Poll closed
				</div>
			)}
			<div className="grid gap-2 p-3 sm:p-4">
				{drinks.map((drink) => {
					const count = counts[drink];
					const percent = total ? Math.round((counts[drink] / total) * 100) : 0;
					return (
						<div key={drink} className="flex items-center gap-1">
							<button
								disabled={!editable}
								onClick={() => onSelect?.(drink)}
								type="button"
								className={cx(
									"relative flex min-h-11 flex-1 items-center justify-between overflow-hidden rounded-xl border px-3.5 text-left text-sm font-semibold",
									editable
										? "transition hover:border-[var(--c-border-3)]"
										: "cursor-default",
									selected === drink
										? "border-[var(--c-brand-lt)] bg-[var(--c-accent-bg)] text-[var(--c-text-mid)]"
										: "border-[var(--c-border-2)] text-[var(--c-text-soft)]",
								)}
							>
								<span
									className="absolute inset-y-0 left-0 bg-[var(--c-accent-bg)] transition-all"
									style={{
										width: editable
											? selected === drink
												? "100%"
												: "0%"
											: `${percent}%`,
									}}
								/>
								<span className="relative">{drink}</span>
								<span className="relative flex items-center gap-2 text-xs text-[var(--c-text-muted)]">
									{count}
									{selected === drink && (
										<span className="grid size-5 place-items-center rounded-full bg-[var(--c-brand-lt)] text-white">
											<Check size={13} strokeWidth={3} />
										</span>
									)}
								</span>
							</button>
							<button
								type="button"
								onClick={() => setInfoDrink(drink)}
								className="grid size-7 shrink-0 place-items-center rounded-lg text-[var(--c-text-dim)] opacity-60 transition hover:bg-[var(--c-muted)] hover:opacity-100"
								aria-label={`Info about ${drink}`}
							>
								<Info size={14} />
							</button>
						</div>
					);
				})}
			</div>
			{onOpen && (
				<button
					className="mx-3 mb-3 flex min-h-11 w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-xl bg-[var(--c-brand)] text-sm font-semibold text-white transition hover:bg-[var(--c-text-mid)] sm:mx-4 sm:mb-4 sm:w-[calc(100%-2rem)]"
					onClick={onOpen}
					type="button"
				>
					<Eye size={16} />
					View details
				</button>
			)}
			{infoDrink && (
				<DrinkInfoSheet drink={infoDrink} onClose={() => setInfoDrink(null)} />
			)}
		</div>
	);
}

// Parse a CSS hex color to normalized RGB
