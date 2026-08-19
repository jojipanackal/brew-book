import { Check, Coffee, X as XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	type Drink,
	drinks,
	type Period,
	type PollRecord,
	type PollSource,
} from "#/lib/drinks";
import { type FlipFluid, FluidRenderer, setupFluidScene } from "#/lib/fluid";
import {
	drinkColors,
	drinkInfo,
	periodDetails,
	sourceFilters,
	todayKey,
} from "../constants";
import { useGyroscope } from "../hooks/use-gyroscope";
import {
	availabilityLabel,
	compactName,
	cx,
	displayDate,
	initials,
	sourceLabel,
} from "../utils";
import { MetaTag } from "./common";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const n = parseInt(hex.replace("#", ""), 16);
	return {
		r: ((n >> 16) & 255) / 255,
		g: ((n >> 8) & 255) / 255,
		b: (n & 255) / 255,
	};
}

export function GlassEasterEgg({ onClose }: { onClose: () => void }) {
	const [activeDrink, setActiveDrink] = useState<Drink>("Coffee");
	const { tilt, permission, requestPermission } = useGyroscope();

	const canvasRef = useRef<HTMLCanvasElement>(null);
	const fluidRef = useRef<FlipFluid | null>(null);
	const rendererRef = useRef<FluidRenderer | null>(null);
	const rafRef = useRef<number>(0);
	const simWidthRef = useRef(3.0);
	const simHeightRef = useRef(4.0);
	// Ref so rAF loop always reads latest tilt without stale closure
	const tiltRef = useRef(tilt);
	useEffect(() => {
		tiltRef.current = tilt;
	}, [tilt]);

	// Init / teardown fluid sim
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || permission !== "granted") return;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = 260 * dpr;
		canvas.height = 380 * dpr;
		simWidthRef.current = 2.6;
		simHeightRef.current = 3.8;

		const color = hexToRgb(drinkColors[activeDrink] ?? "#a36f43");
		const foam = {
			r: Math.min(1, color.r + 0.35),
			g: Math.min(1, color.g + 0.25),
			b: Math.min(1, color.b + 0.2),
		};

		fluidRef.current = setupFluidScene(
			simWidthRef.current,
			simHeightRef.current,
			60,
			0.6,
			0.75,
			color,
			foam,
			0.0008,
			0.4,
		);
		rendererRef.current = new FluidRenderer(canvas);

		const dt = 1.0 / 120.0;

		function loop() {
			const f = fluidRef.current;
			const r = rendererRef.current;
			if (!f || !r) return;

			const gx = (tiltRef.current.gamma / 45) * 9.81;
			const gy = -9.81;

			f.simulate(dt, gx, gy, 0.95, 50, 2, 1.7, true, true, 1.0);
			r.render(f, {
				simWidth: simWidthRef.current,
				simHeight: simHeightRef.current,
			});
			rafRef.current = requestAnimationFrame(loop);
		}
		rafRef.current = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(rafRef.current);
			fluidRef.current = null;
			rendererRef.current = null;
		};
	}, [permission, activeDrink]);

	// Update fluid color when drink changes
	useEffect(() => {
		const f = fluidRef.current;
		if (!f) return;
		const color = hexToRgb(drinkColors[activeDrink] ?? "#a36f43");
		const foam = {
			r: Math.min(1, color.r + 0.35),
			g: Math.min(1, color.g + 0.25),
			b: Math.min(1, color.b + 0.2),
		};
		f.setFluidColor(color);
		f.setFoamColor(foam);
	}, [activeDrink]);

	// Permission-first screen
	if (permission !== "granted") {
		return (
			<div
				className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[var(--c-page)] px-8 text-center"
				style={{ paddingTop: "env(safe-area-inset-top)" }}
			>
				<button
					type="button"
					onClick={onClose}
					className="absolute right-5 top-5 text-sm font-semibold text-[var(--c-text-muted)] transition hover:text-[var(--c-brand)]"
				>
					Close
				</button>
				<div className="grid size-20 place-items-center rounded-full bg-[var(--c-accent-bg)] text-[var(--c-brand)]">
					<Coffee size={36} />
				</div>
				<div>
					<h2 className="font-serif text-2xl font-bold text-[var(--c-text-dark)]">
						Glass Simulator
					</h2>
					<p className="mt-2 text-sm text-[var(--c-text-muted)]">
						Tilt your phone to swirl your drink.
						<br />
						Tilt forward to take a sip.
					</p>
				</div>
				{permission === "unknown" && (
					<button
						type="button"
						onClick={requestPermission}
						className="rounded-full bg-[var(--c-brand)] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[var(--c-brand-h)]"
					>
						Enable motion sensor
					</button>
				)}
				{permission === "denied" && (
					<p className="text-sm text-[var(--c-text-err)]">
						Permission denied. Enable Motion in iOS Settings.
					</p>
				)}
			</div>
		);
	}

	const drinkHex = drinkColors[activeDrink] ?? "#a36f43";

	return (
		<div
			className="fixed inset-0 z-50 flex flex-col bg-[var(--c-page)]"
			style={{ paddingTop: "env(safe-area-inset-top)" }}
		>
			{/* SVG defs for metaball filter */}
			<svg width="0" height="0" className="absolute" aria-hidden="true">
				<defs>
					<filter
						id="fluid-metaball"
						x="-20%"
						y="-20%"
						width="140%"
						height="140%"
						colorInterpolationFilters="sRGB"
					>
						<feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
						<feColorMatrix
							in="blur"
							mode="matrix"
							values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 28 -10"
							result="blob"
						/>
					</filter>
					<clipPath id="glass-clip" clipPathUnits="objectBoundingBox">
						{/* trapezoid: top wider, bottom narrower — glass shape */}
						<polygon points="0.08,0 0.92,0 0.82,1 0.18,1" />
					</clipPath>
				</defs>
			</svg>

			{/* Header */}
			<div className="flex items-center justify-between border-b border-[var(--c-border)] px-5 py-4">
				<span className="font-serif text-lg font-bold text-[var(--c-brand)]">
					Glass Simulator
				</span>
				<button
					type="button"
					onClick={onClose}
					className="text-sm font-semibold text-[var(--c-text-muted)] transition hover:text-[var(--c-brand)]"
				>
					Done
				</button>
			</div>

			{/* Glass area */}
			<div className="flex flex-1 flex-col items-center justify-center gap-4 px-8">
				<p className="text-sm font-semibold text-[var(--c-text-mid)]">
					{activeDrink}
				</p>

				{/* Glass wrapper: fixed proportions, glass clip + metaball */}
				<div className="relative" style={{ width: 260, height: 380 }}>
					{/* Glass border SVG overlay */}
					<svg
						aria-hidden="true"
						viewBox="0 0 260 380"
						width="260"
						height="380"
						className="absolute inset-0 z-20 pointer-events-none"
					>
						{/* Glass outline */}
						<polygon
							points="20,0 240,0 214,380 46,380"
							fill="none"
							stroke="var(--c-border-3)"
							strokeWidth="3"
							strokeLinejoin="round"
						/>
						{/* Highlight */}
						<line
							x1="48"
							y1="12"
							x2="58"
							y2="345"
							stroke="white"
							strokeWidth="4"
							strokeLinecap="round"
							opacity="0.18"
						/>
						<line
							x1="66"
							y1="5"
							x2="72"
							y2="70"
							stroke="white"
							strokeWidth="2.5"
							strokeLinecap="round"
							opacity="0.14"
						/>
					</svg>

					{/* Canvas inside glass with metaball filter + clip */}
					<div
						className="absolute inset-0 overflow-hidden"
						style={{
							clipPath: "polygon(8% 0%, 92% 0%, 82% 100%, 18% 100%)",
						}}
					>
						<div
							style={{
								filter: "url(#fluid-metaball)",
								width: "100%",
								height: "100%",
								background: "transparent",
							}}
						>
							<canvas
								ref={canvasRef}
								style={{
									width: "100%",
									height: "100%",
									display: "block",
									background: "transparent",
								}}
							/>
						</div>
					</div>
				</div>

				<p className="text-xs text-[var(--c-text-dim)]">Tilt to swirl</p>
			</div>

			{/* Drink picker */}
			<div className="border-t border-[var(--c-border)] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
				<p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-[var(--c-text-dim)]">
					Pick a drink
				</p>
				<div className="flex flex-wrap justify-center gap-2">
					{drinks
						.filter((d) => d !== "No drink")
						.map((d) => (
							<button
								key={d}
								type="button"
								onClick={() => setActiveDrink(d)}
								style={
									activeDrink === d
										? {
												background: drinkHex,
												borderColor: drinkHex,
												color: "white",
											}
										: undefined
								}
								className={cx(
									"rounded-full border px-3 py-1.5 text-xs font-semibold transition",
									activeDrink !== d &&
										"border-[var(--c-border)] text-[var(--c-text-muted)] hover:bg-[var(--c-muted)]",
								)}
							>
								{d}
							</button>
						))}
				</div>
			</div>
		</div>
	);
}

export function DrinkInfoSheet({
	drink,
	onClose,
}: {
	drink: Drink;
	onClose: () => void;
}) {
	const info = drinkInfo[drink];
	const [dragY, setDragY] = useState(0);
	const dragStart = useState<number | null>(null);

	function handleTouchStart(e: React.TouchEvent) {
		dragStart[1](e.touches[0].clientY);
		setDragY(0);
	}
	function handleTouchMove(e: React.TouchEvent) {
		if (dragStart[0] === null) return;
		const delta = e.touches[0].clientY - dragStart[0];
		if (delta > 0) setDragY(delta);
	}
	function handleTouchEnd() {
		if (dragY > 80) onClose();
		else setDragY(0);
		dragStart[1](null);
	}

	if (!info) return null;
	return (
		<div className="fixed inset-0 z-40 flex items-end overscroll-none bg-[var(--c-text)]/10 p-0 sm:items-center sm:justify-center sm:p-4">
			<button
				className="absolute inset-0 cursor-default bg-[var(--c-text)]/30 [touch-action:none]"
				onClick={onClose}
				type="button"
				aria-label="Close"
			/>
			<section
				className="no-scrollbar relative z-10 flex h-[88svh] w-full flex-col overflow-y-auto rounded-t-3xl bg-[var(--c-card)] overscroll-contain shadow-2xl sm:h-auto sm:max-h-[88svh] sm:max-w-lg sm:rounded-2xl"
				style={{
					transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
					transition: dragY === 0 ? "transform 0.25s ease" : "none",
				}}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
			>
				{/* Drag area */}
				<div
					className="relative flex min-h-14 shrink-0 touch-none items-start justify-center px-4 pt-3"
					onTouchStart={handleTouchStart}
					onTouchMove={handleTouchMove}
					onTouchEnd={handleTouchEnd}
				>
					<div className="mt-0 h-1 w-10 rounded-full bg-[var(--c-drag)] sm:hidden" />
					<button
						aria-label="Close drink information"
						className="absolute right-3 top-2 grid size-9 place-items-center rounded-full text-[var(--c-text-muted)] transition hover:bg-[var(--c-muted)] hover:text-[var(--c-text-mid)]"
						onClick={onClose}
						type="button"
					>
						<XIcon size={18} />
					</button>
				</div>

				{/* Hero */}
				<div className="flex flex-col items-center gap-2 bg-[var(--c-accent-bg)] px-6 py-8 text-center">
					<span className="grid size-16 place-items-center rounded-full bg-[var(--c-card)] text-[var(--c-brand)]">
						<Coffee size={32} />
					</span>
					<h2 className="mt-1 font-serif text-2xl font-bold text-[var(--c-text-dark)]">
						{drink}
					</h2>
					<p className="text-sm text-[var(--c-text-muted)]">{info.tagline}</p>
				</div>

				<div className="grid gap-5 px-4 py-5 sm:px-6">
					{/* Nutrition */}
					<div>
						<h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--c-brand-lt)]">
							Nutrition per cup
						</h3>
						<div className="grid grid-cols-2 gap-2">
							{info.nutrition.map((n) => (
								<div
									key={n.label}
									className="rounded-xl bg-[var(--c-row)] px-3 py-2.5"
								>
									<p className="text-[11px] text-[var(--c-text-dim)]">
										{n.label}
									</p>
									<p className="mt-0.5 text-sm font-semibold text-[var(--c-text-dark)]">
										{n.value}
									</p>
								</div>
							))}
						</div>
					</div>

					{/* Pros */}
					<div>
						<h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--c-brand-lt)]">
							Pros
						</h3>
						<ul className="grid gap-1.5">
							{info.pros.map((p) => (
								<li
									key={p}
									className="flex items-start gap-2 text-sm text-[var(--c-text)]"
								>
									<Check size={13} className="mt-0.5 shrink-0 text-green-600" />
									{p}
								</li>
							))}
						</ul>
					</div>

					{/* Cons */}
					<div>
						<h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--c-brand-lt)]">
							Cons
						</h3>
						<ul className="grid gap-1.5">
							{info.cons.map((c) => (
								<li
									key={c}
									className="flex items-start gap-2 text-sm text-[var(--c-text)]"
								>
									<XIcon
										size={13}
										className="mt-0.5 shrink-0 text-[var(--c-text-err)]"
									/>
									{c}
								</li>
							))}
						</ul>
					</div>
				</div>
			</section>
		</div>
	);
}

export function PollDetailsSheet({
	date,
	period,
	polls,
	onClose,
}: {
	date: string;
	period: Period;
	polls: PollRecord[];
	onClose: () => void;
}) {
	const [sourceFilter, setSourceFilter] = useState<PollSource | "all">("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [dragY, setDragY] = useState(0);
	const dragStart = useState<number | null>(null);
	const periodInfo = periodDetails.find((item) => item.id === period);
	const filteredPolls =
		sourceFilter === "all"
			? polls
			: polls.filter((item) => item.sources[period] === sourceFilter);
	const normalizedSearchQuery = searchQuery.trim().toLowerCase();
	const searchedPolls = filteredPolls.filter(
		(item) =>
			!normalizedSearchQuery ||
			`${item.user.name} ${item.user.email}`
				.toLowerCase()
				.includes(normalizedSearchQuery),
	);
	const awayPolls = filteredPolls.filter(
		(item) =>
			item.availability[period] !== "office" &&
			(!normalizedSearchQuery ||
				`${item.user.name} ${item.user.email}`
					.toLowerCase()
					.includes(normalizedSearchQuery)),
	);

	function handleTouchStart(e: React.TouchEvent) {
		dragStart[1](e.touches[0].clientY);
		setDragY(0);
	}
	function handleTouchMove(e: React.TouchEvent) {
		if (dragStart[0] === null) return;
		const delta = e.touches[0].clientY - dragStart[0];
		if (delta > 0) setDragY(delta);
	}
	function handleTouchEnd() {
		if (dragY > 80) onClose();
		else setDragY(0);
		dragStart[1](null);
	}

	return (
		<div className="fixed inset-0 z-30 flex items-end overscroll-none bg-[var(--c-text)]/10 p-0 sm:items-center sm:justify-center sm:p-4">
			<button
				className="absolute inset-0 cursor-default bg-[var(--c-text)]/30 [touch-action:none]"
				onClick={onClose}
				type="button"
				aria-label="Close poll details"
			/>
			<section
				className="relative z-10 flex h-[88svh] min-h-0 w-full flex-col rounded-t-3xl bg-[var(--c-card)] px-4 pb-6 pt-3 shadow-2xl overscroll-contain sm:h-auto sm:max-h-[88svh] sm:max-w-lg sm:rounded-2xl sm:p-6"
				style={{
					transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
					transition: dragY === 0 ? "transform 0.25s ease" : "none",
				}}
			>
				<div className="shrink-0 border-b border-[var(--c-border-2)] pb-4">
					<div
						className="[touch-action:none]"
						onTouchStart={handleTouchStart}
						onTouchMove={handleTouchMove}
						onTouchEnd={handleTouchEnd}
					>
						<div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-[var(--c-drag)] sm:hidden" />
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--c-brand-lt)]">
									{date === todayKey ? "Today" : displayDate(date)}
								</p>
								<h2 className="mt-1 font-serif text-2xl text-[var(--c-text-dark)]">
									{periodInfo?.label ?? period}
								</h2>
								<p className="mt-1 text-sm text-[var(--c-text-dim)]">
									{searchedPolls.length}{" "}
									{searchedPolls.length === 1 ? "response" : "responses"}
								</p>
							</div>
							<button
								aria-label="Close poll details"
								className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--c-text-muted)] transition hover:bg-[var(--c-muted)] hover:text-[var(--c-text-mid)]"
								onClick={onClose}
								type="button"
							>
								<XIcon size={18} />
							</button>
						</div>
					</div>
					<div className="mt-4 grid grid-cols-4 gap-2">
						{sourceFilters.map((filter) => (
							<button
								key={filter}
								onClick={() => setSourceFilter(filter)}
								type="button"
								className={cx(
									"min-h-9 rounded-lg border px-2 text-xs font-semibold capitalize transition",
									sourceFilter === filter
										? "border-[var(--c-brand)] bg-[var(--c-brand)] text-white"
										: "border-[var(--c-border)] text-[var(--c-text-muted)] hover:bg-[var(--c-muted)]",
								)}
							>
								{filter === "all" ? "All" : sourceLabel(filter)}
							</button>
						))}
					</div>
					<div className="relative mt-3">
						<input
							aria-label="Search poll responses"
							className="h-10 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 pr-10 text-sm outline-none focus:border-[var(--c-brand-lt)]"
							onChange={(event) => setSearchQuery(event.target.value)}
							placeholder="Search people by name or email"
							value={searchQuery}
						/>
						{searchQuery && (
							<button
								aria-label="Clear poll response search"
								className="absolute right-1 top-1 grid size-8 place-items-center rounded-md text-[var(--c-text-muted)] hover:bg-[var(--c-muted)]"
								onClick={() => setSearchQuery("")}
								type="button"
							>
								×
							</button>
						)}
					</div>
				</div>
				<div className="no-scrollbar mt-4 min-h-0 flex-1 grid content-start gap-4 overflow-y-auto overscroll-contain [touch-action:pan-y]">
					{awayPolls.length > 0 && !normalizedSearchQuery && (
						<section>
							<h3 className="mb-2 text-base font-semibold text-[var(--c-text-muted)]">
								Not ordering this round
							</h3>
							<div className="grid gap-2">
								{awayPolls.map((item) => (
									<div
										className="flex items-center justify-between rounded-xl bg-[var(--c-row)] px-3 py-2.5"
										key={item.user.email}
									>
										<span className="min-w-0 truncate text-sm font-semibold">
											{compactName(item.user)}
										</span>
										<span className="flex shrink-0 flex-wrap justify-end gap-1">
											<MetaTag muted>
												{availabilityLabel(item.availability[period])}
											</MetaTag>
											<MetaTag muted>
												{sourceLabel(item.availabilitySources[period])}
											</MetaTag>
										</span>
									</div>
								))}
							</div>
						</section>
					)}
					{drinks.map((drink) => {
						const drinkPolls = searchedPolls.filter(
							(item) =>
								item.availability[period] === "office" &&
								item.choices[period] === drink,
						);
						const sugarFreeCount = drinkPolls.filter(
							(item) => !item.sugar[period],
						).length;
						if (!drinkPolls.length) return null;
						return (
							<section key={drink}>
								<h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-[var(--c-brand)]">
									{drink}
									<span className="text-sm font-semibold text-[var(--c-text-dim)]">
										{drinkPolls.length}
										{sugarFreeCount ? ` (${sugarFreeCount} SF)` : ""}
									</span>
								</h3>
								<div className="grid gap-2">
									{drinkPolls.map((item) => (
										<div
											className="flex items-center justify-between gap-3 rounded-xl bg-[var(--c-row)] px-3 py-2.5"
											key={item.user.email}
										>
											<div className="flex min-w-0 items-center gap-2.5">
												<span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--c-avatar)] text-[11px] font-semibold text-[var(--c-text-mid)]">
													{initials(compactName(item.user))}
												</span>
												<span className="truncate text-sm font-semibold">
													{compactName(item.user)}
												</span>
											</div>
											<span className="flex shrink-0 flex-wrap justify-end gap-1">
												<MetaTag>
													{item.sugar[period] ? "Sugar" : "No sugar"}
												</MetaTag>
												<MetaTag muted>
													{sourceLabel(item.sources[period])}
												</MetaTag>
											</span>
										</div>
									))}
								</div>
							</section>
						);
					})}
					{searchedPolls.length === 0 && (
						<p className="rounded-xl bg-[var(--c-row)] px-3 py-3 text-sm text-[var(--c-text-muted)]">
							No responses found.
						</p>
					)}
				</div>
			</section>
		</div>
	);
}
