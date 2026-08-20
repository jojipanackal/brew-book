import {
	CalendarOff,
	Check,
	Coffee,
	Eye,
	Info,
	X as XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	Banner,
	Button,
	Card,
	IconButton,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Spinner,
	Switch,
} from "#/components/ui";
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
	const morningNotOpen = nowIST < 10 * 60 + 30;
	const eveningNotOpen = nowIST < 14 * 60 + 30;
	const eveningClosed = nowIST >= 15 * 60 + 15;

	const isPeriodClosed = (id: Period) =>
		id === "morning"
			? morningNotOpen || morningClosed
			: eveningNotOpen || eveningClosed;

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
				title={pianoMode ? "Piano Mode" : "Today"}
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
								closedMessage={
									period.id === "morning"
										? morningNotOpen
											? "Poll opens at 10:30 AM"
											: "Poll closed"
										: eveningNotOpen
											? "Poll opens at 2:30 PM"
											: "Poll closed"
								}
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
	const hasMultiplePeriods = periods.length > 1;

	const [open, setOpen] = useState(false);
	const [halfDay, setHalfDay] = useState(false);
	const [pending, setPending] = useState<
		Array<{ period: Period; status: AttendanceStatus }>
	>([]);

	useEffect(() => {
		if (!open) setPending([]);
	}, [open]);

	useEffect(() => {
		if (!open || loading !== null || pending.length === 0) return;
		const next = pending[0];
		setPending((q) => q.slice(1));
		onChange?.(next.period, next.status);
	}, [open, loading, pending, onChange]);

	if (visiblePeriods.length === 0) return null;

	function handleOpen() {
		setHalfDay(
			hasMultiplePeriods && availability.morning !== availability.evening,
		);
		setOpen(true);
	}

	function setPeriodStatus(period: Period, status: AttendanceStatus) {
		onChange?.(period, status);
	}

	function setFullDayStatus(status: AttendanceStatus) {
		if (visiblePeriods.length === 0) return;
		setPeriodStatus(visiblePeriods[0], status);
		if (visiblePeriods.length > 1) {
			setPending([{ period: visiblePeriods[1], status }]);
		}
	}

	return (
		<>
			<Button
				type="button"
				variant="primary"
				fullWidth
				onClick={handleOpen}
				className="gap-2"
			>
				<CalendarOff size={17} />
				Mark your absence
			</Button>
			{open && (
				<div className="fixed inset-0 z-40 flex items-center justify-center overscroll-none bg-[var(--c-text)]/10 p-4">
					<button
						type="button"
						className="absolute inset-0 cursor-default bg-[var(--c-text)]/30"
						onClick={() => setOpen(false)}
						aria-label="Close"
					/>
					<section className="relative z-10 w-full max-w-md rounded-2xl bg-[var(--c-card)] p-5 shadow-2xl">
						<div className="mb-4 flex items-center justify-between">
							<h2 className="font-serif text-lg font-semibold text-[var(--c-text-dark)]">
								Mark your absence
							</h2>
							<button
								type="button"
								className="grid size-9 place-items-center rounded-full text-[var(--c-text-muted)] transition hover:bg-[var(--c-muted)] hover:text-[var(--c-text-mid)]"
								onClick={() => setOpen(false)}
								aria-label="Close"
							>
								<XIcon size={18} />
							</button>
						</div>
						{hasMultiplePeriods && (
							<label
								htmlFor="leave-halfday"
								className="mb-4 flex items-center justify-between gap-3 text-sm font-semibold text-[var(--c-text-mid)]"
							>
								<span>Half day</span>
								<Switch
									id="leave-halfday"
									checked={halfDay}
									onCheckedChange={setHalfDay}
									disabled={loading !== null}
								/>
							</label>
						)}
						<div className="grid gap-3">
							{halfDay ? (
								periods.map((period) => (
									<label
										key={period}
										htmlFor={`leave-${period}`}
										className="grid gap-1.5 text-xs font-semibold text-[var(--c-text-muted)]"
									>
										<span>{period === "morning" ? "Morning" : "Evening"}</span>
										<Select
											disabled={
												loading !== null || !visiblePeriods.includes(period)
											}
											value={availability[period]}
											onValueChange={(value) =>
												setPeriodStatus(period, value as AttendanceStatus)
											}
										>
											<SelectTrigger id={`leave-${period}`} className="px-2">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{(Object.keys(labels) as AttendanceStatus[]).map(
													(status) => (
														<SelectItem key={status} value={status}>
															{labels[status]}
														</SelectItem>
													),
												)}
											</SelectContent>
										</Select>
										{loading === period && (
											<Spinner className="size-4 text-[var(--c-brand-lt)]" />
										)}
									</label>
								))
							) : (
								<label
									htmlFor="leave-full"
									className="grid gap-1.5 text-xs font-semibold text-[var(--c-text-muted)]"
								>
									<span>Full day</span>
									<Select
										disabled={loading !== null}
										value={availability[visiblePeriods[0]]}
										onValueChange={(value) =>
											setFullDayStatus(value as AttendanceStatus)
										}
									>
										<SelectTrigger id="leave-full" className="px-2">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{(Object.keys(labels) as AttendanceStatus[]).map(
												(status) => (
													<SelectItem key={status} value={status}>
														{labels[status]}
													</SelectItem>
												),
											)}
										</SelectContent>
									</Select>
									{loading !== null && (
										<Spinner className="size-4 text-[var(--c-brand-lt)]" />
									)}
								</label>
							)}
						</div>
					</section>
				</div>
			)}
		</>
	);
}

function DrinkPoll({
	period,
	closed = false,
	closedMessage = "Poll closed",
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
	closedMessage?: string;
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
	const pollUpcoming = closedMessage.startsWith("Poll opens");
	return (
		<Card className="overflow-hidden">
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
				<Banner variant={pollUpcoming ? "success" : "error"} dot>
					{closedMessage}
				</Banner>
			)}
			<div className="grid gap-2 p-3 sm:p-4">
				{drinks.map((drink) => {
					const count = counts[drink];
					const percent = total ? Math.round((counts[drink] / total) * 100) : 0;
					return (
						<div key={drink} className="flex items-center gap-1">
							<Button
								disabled={!editable}
								onClick={() => onSelect?.(drink)}
								type="button"
								variant="outline"
								className={cx(
									"relative min-h-11 flex-1 items-center justify-between overflow-hidden text-left",
									editable
										? "hover:border-[var(--c-border-3)]"
										: "cursor-default",
									selected === drink
										? "border-[var(--c-brand-lt)] bg-[var(--c-accent-bg)] text-[var(--c-text-mid)]"
										: "",
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
							</Button>
							<IconButton
								onClick={() => setInfoDrink(drink)}
								className="size-7 shrink-0 opacity-60 hover:opacity-100"
								aria-label={`Info about ${drink}`}
							>
								<Info size={14} />
							</IconButton>
						</div>
					);
				})}
			</div>
			{onOpen && (
				<Button
					variant="secondary"
					className="mx-3 mb-3 w-[calc(100%-1.5rem)] sm:mx-4 sm:mb-4 sm:w-[calc(100%-2rem)]"
					onClick={onOpen}
					type="button"
				>
					<Eye size={16} />
					View details
				</Button>
			)}
			{infoDrink && (
				<DrinkInfoSheet drink={infoDrink} onClose={() => setInfoDrink(null)} />
			)}
		</Card>
	);
}

// Parse a CSS hex color to normalized RGB
