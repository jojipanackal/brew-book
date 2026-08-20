import {
	ArrowLeft,
	ArrowRight,
	CalendarDays,
	ChevronRight,
	Coffee,
	LogOut,
	Moon,
	Sun,
} from "lucide-react";
import { useState } from "react";
import {
	Button,
	CalendarDay,
	Card,
	Empty,
	IconButton,
	ListRow,
	Spinner,
	Switch,
} from "#/components/ui";
import {
	type Drink,
	type DrinkChoice,
	drinks,
	type Period,
	type PollRecord,
	periods,
	type SugarChoice,
	type User,
} from "#/lib/drinks";
import { periodDetails, todayKey } from "../constants";
import { compactName, cx, displayDate, initials, sourceLabel } from "../utils";
import { MetaTag, PageHeader } from "./common";
import { DefaultDrinkSetting } from "./drink-settings";

export function ProfileView({
	user,
	defaults,
	sugarDefaults,
	updateDefault,
	onSignOut,
	isGuest,
	dark,
	onToggleTheme,
	historyDate,
	setHistoryDate,
	historyPolls,
	historyLoading,
}: {
	user: User;
	defaults: DrinkChoice;
	sugarDefaults: SugarChoice;
	updateDefault: (period: Period, drink: Drink, sugar: boolean) => void;
	onSignOut: () => void;
	isGuest: boolean;
	dark: boolean;
	onToggleTheme: () => void;
	historyDate: string;
	setHistoryDate: (d: string) => void;
	historyPolls: PollRecord[];
	historyLoading: boolean;
}) {
	const [defaultsOpen, setDefaultsOpen] = useState(false);
	const [historyOpen, setHistoryOpen] = useState(false);
	function tapAvatar() {
		window.open("https://www.youtube.com/watch?v=xvFZjo5PgG0", "_blank");
	}
	return (
		<div className="grid gap-3">
			<PageHeader eyebrow="Account" title="Profile" />

			{/* User card */}
			<Card className="shadow-[0_8px_30px_rgba(77,57,38,0.04)]">
				<div className="flex items-center gap-4 p-4">
					<Button
						type="button"
						onClick={tapAvatar}
						variant="ghost"
						className="size-14 shrink-0 rounded-full bg-[var(--c-brand-pale)] p-0 text-lg font-semibold text-[var(--c-brand)]"
					>
						{initials(user.name)}
					</Button>
					<div className="min-w-0">
						<p className="truncate font-semibold text-[var(--c-text-dark)]">
							{user.name}
						</p>
						<p className="truncate text-sm text-[var(--c-text-muted)]">
							{isGuest ? "Guest access" : user.email}
						</p>
					</div>
				</div>

				<div className="border-t border-[var(--c-border)]">
					{/* Theme row */}
					<div className="flex items-center justify-between px-4 py-3.5">
						<span className="flex items-center gap-2.5 text-sm font-semibold text-[var(--c-text-mid)]">
							{dark ? <Moon size={15} /> : <Sun size={15} />}
							{dark ? "Dark mode" : "Light mode"}
						</span>
						<Switch
							checked={dark}
							onChange={onToggleTheme}
							aria-label="Toggle theme"
						/>
					</div>

					{/* Drink defaults row */}
					{!isGuest && (
						<>
							<Button
								type="button"
								onClick={() => setDefaultsOpen((o) => !o)}
								variant="ghost"
								fullWidth
								className="items-center justify-between rounded-none border-t border-[var(--c-border)] px-4 py-3.5 text-left text-sm font-semibold text-[var(--c-text-mid)]"
							>
								<span className="flex items-center gap-2.5">
									<Coffee size={15} />
									Drink defaults
								</span>
								<ChevronRight
									size={15}
									className={cx(
										"transition-transform duration-200 text-[var(--c-text-dim)]",
										defaultsOpen && "rotate-90",
									)}
								/>
							</Button>
							{defaultsOpen && (
								<div className="grid gap-3 border-t border-[var(--c-border)] px-4 py-4">
									{periodDetails.map((period) => (
										<DefaultDrinkSetting
											key={period.id}
											period={period}
											selected={defaults[period.id]}
											sugar={sugarDefaults[period.id]}
											onSelect={(drink) =>
												updateDefault(
													period.id,
													drink,
													sugarDefaults[period.id],
												)
											}
											onToggleSugar={(sugar) =>
												updateDefault(period.id, defaults[period.id], sugar)
											}
										/>
									))}
								</div>
							)}
						</>
					)}

					{/* History row */}
					<Button
						type="button"
						onClick={() => setHistoryOpen((o) => !o)}
						variant="ghost"
						fullWidth
						className="items-center justify-between rounded-none border-t border-[var(--c-border)] px-4 py-3.5 text-left text-sm font-semibold text-[var(--c-text-mid)]"
					>
						<span className="flex items-center gap-2.5">
							<CalendarDays size={15} />
							History
						</span>
						<ChevronRight
							size={15}
							className={cx(
								"transition-transform duration-200 text-[var(--c-text-dim)]",
								historyOpen && "rotate-90",
							)}
						/>
					</Button>
					{historyOpen && (
						<div className="border-t border-[var(--c-border)]">
							<HistoryView
								date={historyDate}
								setDate={setHistoryDate}
								polls={historyPolls}
								loading={historyLoading}
							/>
						</div>
					)}

					{/* Contribute row */}
					<a
						href="https://github.com/jojipanackal/brew-book"
						target="_blank"
						rel="noopener noreferrer"
						className="flex w-full items-center gap-2.5 border-t border-[var(--c-border)] px-4 py-3.5 text-sm font-semibold text-[var(--c-text-mid)] transition hover:bg-[var(--c-muted)]"
					>
						<svg
							viewBox="0 0 24 24"
							fill="currentColor"
							className="size-4 shrink-0"
							aria-hidden="true"
						>
							<path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.461-1.11-1.461-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
						</svg>
						Contribute on GitHub
					</a>
					{/* Sign out row */}
					<Button
						onClick={onSignOut}
						type="button"
						variant="danger"
						fullWidth
						className="items-center gap-2.5 rounded-none border-0 border-t border-[var(--c-border)] px-4 py-3.5 text-left text-sm"
					>
						<LogOut size={15} />
						Sign out
					</Button>
				</div>
			</Card>
		</div>
	);
}

function MiniCalendar({
	selected,
	onSelect,
}: {
	selected: string;
	onSelect: (d: string) => void;
}) {
	const [viewYear, setViewYear] = useState(() => Number(selected.slice(0, 4)));
	const [viewMonth, setViewMonth] = useState(
		() => Number(selected.slice(5, 7)) - 1,
	);

	const todayParts = todayKey.split("-").map(Number);
	const todayY = todayParts[0],
		todayM = todayParts[1] - 1,
		todayD = todayParts[2];

	const firstDay = new Date(viewYear, viewMonth, 1).getDay();
	const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
	const monthName = new Intl.DateTimeFormat("en-US", {
		month: "long",
		year: "numeric",
	}).format(new Date(viewYear, viewMonth));

	const canNext =
		viewYear < todayY || (viewYear === todayY && viewMonth < todayM);

	function prevMonth() {
		if (viewMonth === 0) {
			setViewMonth(11);
			setViewYear((y) => y - 1);
		} else setViewMonth((m) => m - 1);
	}
	function nextMonth() {
		if (!canNext) return;
		if (viewMonth === 11) {
			setViewMonth(0);
			setViewYear((y) => y + 1);
		} else setViewMonth((m) => m + 1);
	}

	const cells: Array<{
		day: number | null;
		key: string | null;
		disabled: boolean;
		isToday: boolean;
		isSelected: boolean;
	}> = [];
	for (let i = 0; i < firstDay; i++)
		cells.push({
			day: null,
			key: `empty-${i}`,
			disabled: true,
			isToday: false,
			isSelected: false,
		});
	for (let d = 1; d <= daysInMonth; d++) {
		const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
		const disabled =
			viewYear > todayY ||
			(viewYear === todayY && viewMonth > todayM) ||
			(viewYear === todayY && viewMonth === todayM && d > todayD);
		cells.push({
			day: d,
			key,
			disabled,
			isToday: viewYear === todayY && viewMonth === todayM && d === todayD,
			isSelected: key === selected,
		});
	}

	return (
		<Card className="p-4">
			<div className="mb-3 flex items-center justify-between">
				<IconButton
					onClick={prevMonth}
					className="size-8"
					aria-label="Previous month"
				>
					<ArrowLeft size={14} />
				</IconButton>
				<span className="text-sm font-semibold text-[var(--c-text-dark)]">
					{monthName}
				</span>
				<IconButton
					onClick={nextMonth}
					disabled={!canNext}
					className="size-8"
					aria-label="Next month"
				>
					<ArrowRight size={14} />
				</IconButton>
			</div>
			<div className="mb-1 grid grid-cols-7 text-center">
				{[
					"Sunday",
					"Monday",
					"Tuesday",
					"Wednesday",
					"Thursday",
					"Friday",
					"Saturday",
				].map((d) => (
					<span
						key={d}
						className="text-[10px] font-semibold text-[var(--c-text-dim)]"
					>
						{d[0]}
					</span>
				))}
			</div>
			<div className="grid grid-cols-7 gap-y-0.5 text-center">
				{cells.map((cell) =>
					cell.day === null ? (
						<span key={cell.key} />
					) : (
						<CalendarDay
							key={cell.key}
							disabled={cell.disabled}
							onClick={() => cell.key && onSelect(cell.key)}
							state={
								cell.isSelected
									? "selected"
									: cell.isToday
										? "today"
										: cell.disabled
											? "disabled"
											: "default"
							}
						>
							{cell.day}
						</CalendarDay>
					),
				)}
			</div>
		</Card>
	);
}

function HistoryView({
	date,
	setDate,
	polls,
	loading = false,
}: {
	date: string;
	setDate: (date: string) => void;
	polls: PollRecord[];
	loading?: boolean;
}) {
	return (
		<div className="grid gap-4 px-4 py-4">
			<div className="flex items-center justify-between">
				<span className="text-sm font-semibold text-[var(--c-text-dark)]">
					{displayDate(date)}
				</span>
				{polls.length > 0 && (
					<span className="text-xs text-[var(--c-text-muted)]">
						{polls.length} people
					</span>
				)}
			</div>
			<MiniCalendar selected={date} onSelect={setDate} />
			{loading ? (
				<div className="flex items-center justify-center py-8">
					<Spinner className="size-6" />
				</div>
			) : (
				<HistoryResponseCards polls={polls} />
			)}
		</div>
	);
}

function HistoryResponseCards({ polls }: { polls: PollRecord[] }) {
	const [openDrink, setOpenDrink] = useState<Drink | null>(null);
	const rows = drinks
		.map((drink) => ({
			drink,
			entries: polls.flatMap((poll) =>
				periods
					.filter((period) => poll.choices[period] === drink)
					.map((period) => ({
						user: poll.user,
						period,
						sugar: poll.sugar[period],
						source: poll.sources[period],
					})),
			),
		}))
		.filter((group) => group.entries.length > 0);
	if (!polls.length) return <Empty>No responses for this day.</Empty>;
	return (
		<div className="grid gap-3">
			{rows.map((group) => (
				<Card className="overflow-hidden" key={group.drink}>
					<Button
						onClick={() =>
							setOpenDrink((current) =>
								current === group.drink ? null : group.drink,
							)
						}
						type="button"
						variant="ghost"
						fullWidth
						className="min-h-14 items-center justify-between gap-3 px-4 text-left"
					>
						<span className="text-sm font-semibold text-[var(--c-text-dark)]">
							{group.drink}
						</span>
						<span className="text-xs font-semibold text-[var(--c-text-muted)]">
							{group.entries.length}
						</span>
					</Button>
					{openDrink === group.drink && (
						<div className="grid gap-2 border-t border-[var(--c-border-2)] p-3">
							{group.entries.map((entry) => (
								<ListRow key={`${entry.user.email}-${entry.period}`}>
									<div className="flex min-w-0 items-center gap-2.5">
										<span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--c-avatar)] text-[11px] font-semibold text-[var(--c-text-mid)]">
											{initials(compactName(entry.user))}
										</span>
										<div className="min-w-0">
											<p className="truncate text-sm font-semibold">
												{compactName(entry.user)}
											</p>
											<p className="text-xs text-[var(--c-text-muted)]">
												{entry.period === "morning" ? "Morning" : "Evening"}
											</p>
										</div>
									</div>
									<span className="flex shrink-0 flex-wrap justify-end gap-1">
										<MetaTag>{entry.sugar ? "Sugar" : "No sugar"}</MetaTag>
										<MetaTag muted>{sourceLabel(entry.source)}</MetaTag>
									</span>
								</ListRow>
							))}
						</div>
					)}
				</Card>
			))}
		</div>
	);
}
