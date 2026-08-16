import { ArrowLeft, ArrowRight, Check, Coffee } from "lucide-react";
import { useEffect, useState } from "react";
import {
	type Company,
	type CompanyRecord,
	drinks,
	getCompanies,
} from "#/lib/drinks";
import { brewingMessages, periodDetails } from "../constants";
import type { OnboardingState } from "../types";
import { cx, pickRandom } from "../utils";
import { SugarToggle } from "./common";
import { BrandMark } from "./navigation";
export function GuestSetupPage({
	onSubmit,
	onBack,
	error,
}: {
	onSubmit: (name: string, company: Company) => void;
	onBack: () => void;
	error: string | null;
}) {
	const [step, setStep] = useState<"name" | "company">("name");
	const [name, setName] = useState("");
	const [company, setCompany] = useState("");
	const [companies, setCompanies] = useState<CompanyRecord[]>([]);
	useEffect(() => {
		void getCompanies()
			.then(setCompanies)
			.catch(() => undefined);
	}, []);
	const back = () => {
		if (step === "company") setStep("name");
		else onBack();
	};
	return (
		<main className="grid min-h-svh place-items-center bg-[var(--c-page)] px-5 py-10 text-[var(--c-text-dark)]">
			<section className="w-full max-w-sm rounded-3xl bg-[var(--c-card)] p-6 shadow-[0_20px_60px_rgba(77,57,38,0.1)] sm:p-8">
				<h1 className="font-serif text-3xl">
					{step === "name" ? "What is your name?" : "Choose your company"}
				</h1>
				{error && (
					<p
						className="mt-4 rounded-xl border border-[var(--c-border-err)] bg-[var(--c-err-bg)] px-3 py-2 text-sm text-[var(--c-text-err)]"
						role="alert"
					>
						{error}
					</p>
				)}
				{step === "name" ? (
					<>
						<label className="mt-7 block text-sm font-semibold text-[var(--c-text-dark)]">
							Name
							<input
								className="mt-2 h-12 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] px-3 text-sm outline-none transition focus:border-[var(--c-brand-lt)]"
								onChange={(event) => setName(event.target.value)}
								placeholder="Your name"
								value={name}
							/>
						</label>
						<div className="mt-7 flex gap-2">
							<button
								onClick={back}
								type="button"
								className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--c-border)] px-3 text-sm font-semibold text-[var(--c-text-mid)]"
							>
								<ArrowLeft size={16} />
								Back
							</button>
							<button
								disabled={name.trim().length < 2}
								onClick={() => setStep("company")}
								type="button"
								className="flex min-h-11 flex-[1.5] items-center justify-center gap-2 rounded-xl bg-[var(--c-brand)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--c-text-mid)] disabled:cursor-not-allowed disabled:opacity-45"
							>
								Next
								<ArrowRight size={16} />
							</button>
						</div>
					</>
				) : (
					<>
						<div className="mt-7 grid gap-2">
							{companies.map((item) => (
								<button
									key={item.id}
									onClick={() => setCompany(item.name)}
									type="button"
									className={cx(
										"flex min-h-12 items-center justify-between rounded-xl border px-3 text-left text-sm font-semibold transition",
										company === item.name
											? "border-[var(--c-brand-lt)] bg-[var(--c-accent-bg)] text-[var(--c-text-mid)]"
											: "border-[var(--c-border-2)] text-[var(--c-text-soft)] hover:border-[var(--c-border-3)]",
									)}
								>
									{item.name}
									{company === item.name && <Check size={16} />}
								</button>
							))}
						</div>
						<div className="mt-7 flex gap-2">
							<button
								onClick={back}
								type="button"
								className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--c-border)] px-3 text-sm font-semibold text-[var(--c-text-mid)]"
							>
								<ArrowLeft size={16} />
								Back
							</button>
							<button
								disabled={!company}
								onClick={() => onSubmit(name.trim(), company)}
								type="button"
								className="min-h-11 flex-[1.5] rounded-xl bg-[var(--c-brand)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--c-text-mid)] disabled:cursor-not-allowed disabled:opacity-45"
							>
								Request access
							</button>
						</div>
					</>
				)}
			</section>
		</main>
	);
}

export function AuthLoading({ message }: { message?: string }) {
	const [msg] = useState(() => message ?? pickRandom(brewingMessages));
	return (
		<main className="grid min-h-svh place-items-center bg-[var(--c-page)]">
			<div className="flex flex-col items-center gap-4">
				<output
					aria-label={msg}
					className="size-10 animate-spin rounded-full border-2 border-[var(--c-border)] border-t-[var(--c-brand)]"
				/>
				<p className="text-sm text-[var(--c-text-muted)]">{msg}</p>
			</div>
		</main>
	);
}
export function SignInPage({
	signIn,
	onGuest,
	onLocalSignUp,
}: {
	signIn: () => void;
	onGuest: () => void;
	onLocalSignUp?: () => void;
}) {
	useEffect(() => {
		const html = document.documentElement;
		const wasDark = html.classList.contains("dark");
		html.classList.remove("dark");
		return () => {
			if (wasDark) html.classList.add("dark");
		};
	}, []);
	return (
		<main className="relative grid min-h-svh place-items-center overflow-hidden bg-[var(--c-page)] px-5 py-10 text-[var(--c-cream)]">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 overflow-hidden text-[#c9ad90]/35"
			>
				<Coffee
					className="absolute -right-24 -top-20 size-[30rem] rotate-12"
					strokeWidth={0.7}
				/>
				<Coffee
					className="absolute -bottom-32 -left-24 size-[24rem] -rotate-12 text-[#e0d0bf]"
					strokeWidth={0.7}
				/>
			</div>
			<section className="relative z-10 flex w-full max-w-sm flex-col items-center rounded-3xl bg-[var(--c-brand)] px-6 py-9 text-center shadow-[0_20px_60px_rgba(77,57,38,0.2)] sm:px-8">
				<BrandMark
					className="size-16 rounded-[18px] bg-[var(--c-cream)] text-[var(--c-brand)]"
					iconColor="#5a3c26"
					iconSize={30}
				/>
				<h1 className="mt-7 font-serif text-5xl leading-tight">BrewBook</h1>
				<p className="mt-4 max-w-xs text-[15px] leading-6 text-[#e7d8c4]">
					Use your work email to continue.
				</p>
				<button
					onClick={signIn}
					type="button"
					className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[var(--c-cream)] text-sm font-semibold text-[var(--c-brand)] shadow-[0_12px_30px_rgba(38,24,16,0.22)] transition hover:bg-white"
				>
					<img alt="" className="size-5" src="/google-g.png" />
					Continue with Google
					<ArrowRight size={17} />
				</button>
				<button
					onClick={onGuest}
					type="button"
					className="mt-3 text-sm font-semibold text-[#e7d8c4] underline decoration-[#c9ad90] underline-offset-4"
				>
					Continue as guest
				</button>
				{onLocalSignUp && (
					<button
						onClick={onLocalSignUp}
						type="button"
						className="mt-2 text-xs font-semibold text-[#e7d8c4] underline decoration-[#c9ad90] underline-offset-4"
					>
						Sign up locally
					</button>
				)}
			</section>
		</main>
	);
}

export function AccessDeniedPage({
	authError = false,
	onSignOut,
}: {
	authError?: boolean;
	onSignOut?: () => void;
}) {
	return (
		<main className="grid min-h-svh place-items-center bg-[var(--c-page)] px-5 text-[var(--c-text-dark)]">
			<section className="w-full max-w-sm rounded-3xl bg-[var(--c-card)] p-8 text-center shadow-[0_20px_60px_rgba(77,57,38,0.1)]">
				<h1 className="font-serif text-3xl">Work email not recognized</h1>
				<p className="mt-3 text-sm leading-6 text-[var(--c-text-muted)]">
					Use an email from a registered company, or request guest access from a
					company administrator.
				</p>
				{authError ? (
					<a
						href="/"
						className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-[var(--c-brand)] px-5 text-sm font-semibold text-white"
					>
						Back to BrewBook
					</a>
				) : (
					<button
						onClick={onSignOut}
						type="button"
						className="mt-7 min-h-11 rounded-xl bg-[var(--c-brand)] px-5 text-sm font-semibold text-white"
					>
						Sign out
					</button>
				)}
			</section>
		</main>
	);
}
export function GuestPendingPage({ onExit }: { onExit: () => void }) {
	return (
		<main className="grid min-h-svh place-items-center bg-[var(--c-page)] px-5 text-[var(--c-text-dark)]">
			<section className="w-full max-w-sm rounded-3xl bg-[var(--c-card)] p-8 text-center shadow-[0_20px_60px_rgba(77,57,38,0.1)]">
				<h1 className="font-serif text-3xl">Waiting for approval</h1>
				<p className="mt-3 text-sm leading-6 text-[var(--c-text-muted)]">
					A company admin needs to approve your guest request before you can
					join today’s polls.
				</p>
				<button
					onClick={onExit}
					type="button"
					className="mt-7 min-h-11 rounded-xl border border-[var(--c-border)] px-5 text-sm font-semibold text-[var(--c-text-mid)]"
				>
					Exit guest access
				</button>
			</section>
		</main>
	);
}
export function GuestRejectedPage({ onExit }: { onExit: () => void }) {
	return (
		<main className="grid min-h-svh place-items-center bg-[var(--c-page)] px-5 text-[var(--c-text-dark)]">
			<section className="w-full max-w-sm rounded-3xl bg-[var(--c-card)] p-8 text-center shadow-[0_20px_60px_rgba(77,57,38,0.1)]">
				<h1 className="font-serif text-3xl">Guest request declined</h1>
				<p className="mt-3 text-sm leading-6 text-[var(--c-text-muted)]">
					Ask the company admin to approve your guest access.
				</p>
				<button
					onClick={onExit}
					type="button"
					className="mt-7 min-h-11 rounded-xl border border-[var(--c-border)] px-5 text-sm font-semibold text-[var(--c-text-mid)]"
				>
					Exit guest access
				</button>
			</section>
		</main>
	);
}

export function OnboardingPage({
	state,
	setState,
	onBack,
	onComplete,
	error,
}: {
	state: OnboardingState;
	setState: (state: OnboardingState) => void;
	onBack: () => void;
	onComplete: () => void;
	error: string | null;
}) {
	const period = state.step === "morning" ? periodDetails[0] : periodDetails[1];
	const next = () => {
		if (state.step === "morning") setState({ ...state, step: "evening" });
		else onComplete();
	};
	const back = () => {
		if (state.step === "evening") setState({ ...state, step: "morning" });
		else onBack();
	};
	const updateSugar = (sugar: boolean) =>
		setState({
			...state,
			sugarDefaults: { ...state.sugarDefaults, [period.id]: sugar },
		});
	return (
		<main className="flex min-h-svh items-center justify-center bg-[var(--c-page)] px-4 py-8 text-[var(--c-text-dark)]">
			<div className="mx-auto w-full max-w-lg">
				<h1 className="mb-5 font-serif text-2xl leading-tight text-[var(--c-text-dark)]">
					Choose your {period.label.toLowerCase()} default
				</h1>
				<section className="rounded-3xl bg-[var(--c-card)] p-5 shadow-[0_20px_60px_rgba(77,57,38,0.1)] sm:p-8">
					<div className="flex justify-end">
						<SugarToggle
							compact
							disabled={state.defaults[period.id] === "No drink"}
							sugar={state.sugarDefaults[period.id]}
							onChange={updateSugar}
						/>
					</div>
					{error && (
						<p
							className="mt-3 rounded-xl border border-[var(--c-border-err)] bg-[var(--c-err-bg)] px-3 py-2 text-sm text-[var(--c-text-err)]"
							role="alert"
						>
							{error}
						</p>
					)}
					<div className="mt-5 grid grid-cols-1 gap-2">
						{drinks.map((drink) => (
							<button
								key={drink}
								onClick={() =>
									setState({
										...state,
										defaults: { ...state.defaults, [period.id]: drink },
									})
								}
								type="button"
								className={cx(
									"flex min-h-12 min-w-0 items-center justify-between rounded-xl border px-3 text-left text-sm font-semibold transition",
									state.defaults[period.id] === drink
										? "border-[var(--c-brand-lt)] bg-[var(--c-accent-bg)] text-[var(--c-text-mid)]"
										: "border-[var(--c-border-2)] text-[var(--c-text-soft)] hover:border-[var(--c-border-3)]",
								)}
							>
								{drink}
								{state.defaults[period.id] === drink && <Check size={15} />}
							</button>
						))}
					</div>
					<div className="mt-8 flex gap-2">
						<button
							onClick={back}
							type="button"
							className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--c-border)] px-3 text-sm font-semibold text-[var(--c-text-mid)]"
						>
							<ArrowLeft size={16} />
							Back
						</button>
						<button
							disabled={!state.defaults[period.id]}
							onClick={next}
							type="button"
							className="flex min-h-11 flex-[1.5] items-center justify-center gap-2 rounded-xl bg-[var(--c-brand)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--c-text-mid)] disabled:cursor-not-allowed disabled:opacity-45"
						>
							{state.step === "evening" ? "Finish setup" : "Next"}
							<ArrowRight size={17} />
						</button>
					</div>
				</section>
			</div>
		</main>
	);
}
export function LocalSetupComplete({ onReset }: { onReset: () => void }) {
	return (
		<main className="grid min-h-svh place-items-center bg-[var(--c-page)] px-5 py-10 text-[var(--c-text-dark)]">
			<section className="w-full max-w-sm rounded-3xl bg-[var(--c-card)] p-8 text-center shadow-[0_20px_60px_rgba(77,57,38,0.1)]">
				<div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--c-brand)] text-[var(--c-cream)]">
					<Check size={26} />
				</div>
				<h1 className="mt-6 font-serif text-3xl">Setup complete</h1>
				<p className="mt-2 text-sm leading-6 text-[var(--c-text-muted)]">
					The local test flow is complete. The app is not loaded in local signup
					mode.
				</p>
				<button
					onClick={onReset}
					type="button"
					className="mt-7 min-h-11 rounded-xl bg-[var(--c-brand)] px-4 text-sm font-semibold text-white"
				>
					Run setup again
				</button>
			</section>
		</main>
	);
}
