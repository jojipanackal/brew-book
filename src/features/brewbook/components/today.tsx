import { useEffect, useState } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui";
import {
	type AttendanceStatus,
	type Drink,
	type DrinkChoice,
	drinks,
	type Period,
	type PollRecord,
	type PollSource,
	type SugarChoice,
} from "#/lib/drinks";
import { todayKey } from "../constants";
import { displayDate } from "../utils";
import { DrinkArtwork } from "./drink-artwork";

export function minutesInIST() {
	const parts = new Intl.DateTimeFormat("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
		timeZone: "Asia/Kolkata",
	}).formatToParts(new Date());
	return (
		Number(parts.find((p) => p.type === "hour")?.value) * 60 +
		Number(parts.find((p) => p.type === "minute")?.value)
	);
}

const attendanceLabels: Record<AttendanceStatus, string> = {
	office: "In office",
	wfh: "Working from home",
	leave: "On leave",
};
const cutoffs: Record<Period, number> = { morning: 660, evening: 915 };
const deadlines: Record<Period, string> = {
	morning: "11:00 am",
	evening: "3:15 pm",
};

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
	saving = false,
	saveMessage = "",
	sources,
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
	saving?: boolean;
	saveMessage?: string;
	sources?: Record<Period, PollSource>;
}) {
	const [now, setNow] = useState(minutesInIST);
	const [period, setPeriod] = useState<Period>(() =>
		minutesInIST() >= 660 ? "evening" : "morning",
	);
	useEffect(() => {
		const timer = window.setInterval(() => setNow(minutesInIST()), 30_000);
		return () => window.clearInterval(timer);
	}, []);
	const closed = now >= cutoffs[period];
	const away = availability[period] !== "office";
	const busy = saving || availabilityLoading !== null;
	const disabled = closed || away;
	const label = period === "morning" ? "Morning" : "Evening";
	const source = sources?.[period];
	return (
		<div className="today-page">
			<p className="eyebrow">{displayDate(todayKey)}</p>
			<fieldset className="period-switch" aria-label="Drink round">
				{(["morning", "evening"] as const).map((round) => (
					<button
						key={round}
						type="button"
						aria-pressed={period === round}
						onClick={() => setPeriod(round)}
					>
						{round === "morning" ? "Morning" : "Evening"}
						<span>{deadlines[round]}</span>
					</button>
				))}
			</fieldset>
			<section
				className="sentence-section"
				aria-label={`${label} drink`}
				aria-busy={busy}
			>
				<h1 className="drink-sentence">
					{away ? (
						<>
							I’m{" "}
							{availability[period] === "leave"
								? "on leave"
								: "working from home"}
							<br className="desktop-break" /> this {period}.
						</>
					) : (
						<>
							I’m having{" "}
							<Select
								value={entry[period]}
								disabled={disabled}
								onValueChange={(value) => {
									if (!busy) updateEntry(period, value as Drink);
								}}
							>
								<SelectTrigger
									className="sentence-choice"
									aria-disabled={disabled || busy}
									onPointerDown={(event) => {
										if (busy) event.preventDefault();
									}}
									onKeyDown={(event) => {
										if (
											busy &&
											[" ", "Enter", "ArrowDown", "ArrowUp"].includes(event.key)
										)
											event.preventDefault();
									}}
									aria-label={`${label} drink`}
									aria-describedby="round-note"
								>
									<SelectValue>{entry[period].toLowerCase()}</SelectValue>
								</SelectTrigger>
								<SelectContent position="popper" align="start">
									{drinks.map((drink) => (
										<SelectItem
											className="min-h-11 pr-9"
											key={drink}
											value={drink}
										>
											{drink}
										</SelectItem>
									))}
								</SelectContent>
							</Select>{" "}
							today
							{entry[period] === "No drink" ? (
								"."
							) : (
								<>
									,<br className="desktop-break" />{" "}
									<button
										className="sentence-choice sugar-choice"
										type="button"
										disabled={disabled}
										aria-label={`${label}: ${sugar[period] ? "with" : "without"} sugar`}
										aria-disabled={disabled || busy}
										aria-pressed={sugar[period]}
										aria-describedby="round-note"
										onClick={() => {
											if (!busy) updateSugar(period, !sugar[period]);
										}}
									>
										{sugar[period] ? "with" : "without"}
									</button>{" "}
									sugar.
								</>
							)}
						</>
					)}
				</h1>
				<p id="round-note" className="sentence-hint">
					{closed
						? `${label} orders closed at ${deadlines[period]} IST.`
						: away
							? "No drink will be ordered for this round."
							: "Tap the underlined words to make it yours."}
				</p>
				<output className="save-status" aria-live="polite" aria-atomic="true">
					{busy
						? "Saving your choice…"
						: saveMessage ||
							(away
								? attendanceLabels[availability[period]]
								: source === "default"
									? "Your usual choice, added automatically."
									: source === "admin"
										? "Updated by your administrator."
										: source === "manual"
											? "Your choice is saved for today."
											: "Your usual choice for this round.")}
				</output>
			</section>
			<div className="today-secondary">
				{!guest && (
					<fieldset
						className="attendance-options"
						aria-describedby="attendance-scope"
					>
						<legend>This {period}, I’m</legend>
						<div className="attendance-choices">
							{(Object.keys(attendanceLabels) as AttendanceStatus[]).map(
								(status) => (
									<label
										key={status}
										className="attendance-option"
										data-selected={availability[period] === status}
									>
										<input
											type="radio"
											name="attendance"
											value={status}
											checked={availability[period] === status}
											disabled={closed || !onUpdateAvailability}
											aria-disabled={closed || busy || !onUpdateAvailability}
											onClick={(event) => {
												if (busy) event.preventDefault();
											}}
											onKeyDown={(event) => {
												if (
													busy &&
													[
														" ",
														"ArrowDown",
														"ArrowUp",
														"ArrowLeft",
														"ArrowRight",
													].includes(event.key)
												)
													event.preventDefault();
											}}
											onChange={() => {
												if (!busy) onUpdateAvailability?.(period, status);
											}}
										/>
										<span>{attendanceLabels[status]}</span>
									</label>
								),
							)}
						</div>
						<p id="attendance-scope" className="attendance-scope">
							{closed
								? "Attendance is closed for this round."
								: `Applies to this ${period} only.`}
						</p>
					</fieldset>
				)}
				<div className="round-actions">
					<p className="round-deadline">
						{closed
							? "This round is complete."
							: `Changes until ${deadlines[period]} IST.`}
					</p>
					<button
						type="button"
						className="text-action"
						onClick={() => onOpen(period)}
					>
						View responses{" "}
						<span className="response-count">{todayPolls.length}</span>
						<span aria-hidden="true">↗</span>
					</button>
				</div>
				<DrinkArtwork drink={entry[period]} away={away} />
			</div>
		</div>
	);
}
