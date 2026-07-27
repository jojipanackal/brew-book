import { ErrorBoundary } from "@sentry/react";
import {
	ArrowLeft,
	ArrowRight,
	CalendarDays,
	Check,
	ChevronRight,
	Coffee,
	Eye,
	History,
	LogOut,
	Search,
	ShieldCheck,
	SlidersHorizontal,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BrewSummary, DrinkGlyph, SaveStatus } from "#/components/brew-visuals";
import { authClient } from "#/lib/auth-client";
import { displayDate, getDateKey, shiftDateKey } from "#/lib/date";
import { createDemoPolls, demoUser } from "#/lib/demo";
import {
	type AdminDashboard,
	type Company,
	type CompanyRecord,
	completeOnboarding,
	createGuest,
	type Drink,
	type DrinkChoice,
	drinks,
	type GuestSession,
	getAdminDashboard,
	getCompanies,
	getDrinkDay,
	getGuestSession,
	getProfile,
	leaveGuest,
	type Period,
	type PollRecord,
	type PollSource,
	periods,
	type SugarChoice,
	saveDefault,
	saveResponse,
	type User,
	updateGuestRequest,
	updateUserResponse,
} from "#/lib/drinks";
import {
	countChoices,
	mergePendingPollResponses,
	upsertPollResponse,
} from "#/lib/polls";
import {
	captureSentryException,
	initSentryClient,
	syncSentryUser,
} from "#/lib/sentry";

type AppState = {
	user: User | null;
	defaults: DrinkChoice;
	sugarDefaults: SugarChoice;
	entries: Record<string, PollRecord[]>;
};
type View = "today" | "history" | "defaults" | "admin";
type OpenPoll = { date: string; period: Period } | null;
type OnboardingState = {
	company: Company | "";
	defaults: DrinkChoice;
	sugarDefaults: SugarChoice;
	step: "company" | "morning" | "evening";
};

const periodDetails: Array<{ id: Period; label: string; helper: string }> = [
	{ id: "morning", label: "Morning", helper: "Before the first prep round" },
	{ id: "evening", label: "Evening", helper: "For the afternoon round" },
];
const initialState: AppState = {
	user: null,
	defaults: { morning: "No drink", evening: "No drink" },
	sugarDefaults: { morning: true, evening: true },
	entries: {},
};
const sourceFilters: Array<PollSource | "all"> = [
	"all",
	"default",
	"manual",
	"admin",
];

initSentryClient();

function dateKeyOffset(offset: number) {
	return shiftDateKey(getDateKey(), -offset);
}
function isGuestUser(user: User) {
	return (
		user.role === "guest" ||
		user.email.startsWith("guest-") ||
		user.email.endsWith("@guest.brewbook.local")
	);
}
function compactName(user: User) {
	const parts = user.name.trim().split(/\s+/).filter(Boolean);
	if (isGuestUser(user)) return `${parts[0] ?? user.name} (Guest)`;
	if (parts.length <= 2) return parts.join(" ");
	return `${parts[0]} ${parts[parts.length - 1]}`;
}
function initials(name: string) {
	return name
		.replace(/\s*\([^)]*\)/g, "")
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 2);
}
function sourceLabel(source: PollSource) {
	return source === "admin"
		? "Admin"
		: source === "manual"
			? "Manual"
			: "Default";
}
function MetaTag({
	children,
	muted = false,
}: {
	children: React.ReactNode;
	muted?: boolean;
}) {
	return (
		<span
			className={cx(
				"inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4",
				muted
					? "border-[#e6e0d6] bg-[#fffdf9] text-[#887f74]"
					: "border-[#dbc9b6] bg-[#f6ece1] text-[#68452e]",
			)}
		>
			{children}
		</span>
	);
}
function isTransientFetchError(reason: unknown) {
	return (
		reason instanceof TypeError &&
		reason.message.toLowerCase().includes("fetch")
	);
}
function readState(): AppState {
	return initialState;
}
function cx(...classes: Array<string | false | null | undefined>) {
	return classes.filter(Boolean).join(" ");
}
function reportSentryError(reason: unknown, fallbackMessage: string) {
	captureSentryException(reason);
	return reason instanceof Error ? reason.message : fallbackMessage;
}
function authErrorMessage() {
	if (typeof window === "undefined") return null;
	const error = new URLSearchParams(window.location.search).get("error");
	if (!error) return null;
	return error;
}
function AppErrorFallback() {
	return (
		<main className="grid min-h-svh place-items-center bg-[#f6f5f1] px-5 text-[#33271f]">
			<section className="w-full max-w-sm rounded-3xl bg-[#fffdf9] p-8 text-center shadow-[0_20px_60px_rgba(77,57,38,0.1)]">
				<h1 className="font-serif text-3xl">Something went wrong</h1>
				<p className="mt-3 text-sm leading-6 text-[#887f74]">
					MyBev hit an unexpected error. Refresh the page or try again in a
					moment.
				</p>
			</section>
		</main>
	);
}

function App() {
	const todayKey = getDateKey();
	const [state, setState] = useState<AppState>(readState);
	const [view, setView] = useState<View>("today");
	const [historyDate, setHistoryDate] = useState(dateKeyOffset(1));
	const [openPoll, setOpenPoll] = useState<OpenPoll>(null);
	const [profileOpen, setProfileOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [profileReady, setProfileReady] = useState(false);
	const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
	const [localUser, setLocalUser] = useState<User | null>(null);
	const [guestSession, setGuestSession] = useState<GuestSession | null>(null);
	const [guestPending, setGuestPending] = useState(true);
	const [guestSetup, setGuestSetup] = useState(false);
	const [accessDenied, setAccessDenied] = useState(false);
	const [adminData, setAdminData] = useState<AdminDashboard | null>(null);
	const [saveState, setSaveState] = useState<
		Partial<Record<Period, "saving" | "saved">>
	>({});
	const saveVersion = useRef<Record<Period, number>>({
		morning: 0,
		evening: 0,
	});
	const pendingResponsePeriods = useRef(new Set<Period>());
	const { data: session, isPending: authPending } = authClient.useSession();
	const sessionUserId = session?.user?.id;
	const sessionUserName = session?.user?.name;
	const sessionUserEmail = session?.user?.email;
	const sessionUserImage = session?.user?.image;
	const todayPoll = state.user
		? state.entries[todayKey]?.find(
				(entry) => entry.user.email === state.user?.email,
			)
		: undefined;
	const todaysEntry = todayPoll?.choices ?? state.defaults;
	const todaysSugar = todayPoll?.sugar ?? state.sugarDefaults;
	const todayPolls = state.entries[todayKey] ?? [];
	const isGuest = Boolean(guestSession);
	const signInError = authErrorMessage();
	useEffect(() => {
		syncSentryUser(
			state.user
				? {
						id: state.user.id,
						name: state.user.name,
						email: state.user.email,
						role: state.user.role,
					}
				: null,
		);
	}, [state.user]);
	useEffect(() => {
		if (authPending) return;
		if (sessionUserId) {
			setGuestSession(null);
			setGuestPending(false);
			return;
		}
		void getGuestSession()
			.then(setGuestSession)
			.catch(() => setGuestSession(null))
			.finally(() => setGuestPending(false));
	}, [authPending, sessionUserId]);
	useEffect(() => {
		if (guestSession?.status !== "pending") return;
		let cancelled = false;
		const interval = window.setInterval(() => {
			void getGuestSession()
				.then((nextGuest) => {
					if (!cancelled) setGuestSession(nextGuest);
				})
				.catch(() => undefined);
		}, 5000);
		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	}, [guestSession?.status]);
	useEffect(() => {
		let cancelled = false;
		if (localUser) {
			setState({ ...initialState, user: localUser });
			setOnboarding({
				company: "Local",
				defaults: initialState.defaults,
				sugarDefaults: initialState.sugarDefaults,
				step: "morning",
			});
			setProfileReady(true);
			return () => {
				cancelled = true;
			};
		}
		if (guestSession) {
			setState({
				...initialState,
				user: guestSession.user,
				defaults: guestSession.defaults,
				sugarDefaults: guestSession.sugarDefaults,
				entries: { [todayKey]: guestSession.responses },
			});
			setOnboarding(null);
			setProfileReady(true);
			return () => {
				cancelled = true;
			};
		}
		if (!sessionUserId || !sessionUserName || !sessionUserEmail) {
			setState(initialState);
			setProfileReady(false);
			setOnboarding(null);
			return () => {
				cancelled = true;
			};
		}
		const user = {
			id: sessionUserId,
			name: sessionUserName,
			email: sessionUserEmail,
			image: sessionUserImage,
		};
		setState((current) => ({ ...current, user }));
		setProfileReady(false);
		const loadProfile = () => {
			void getProfile()
				.then((profile) => {
					if (cancelled) return;
					setState((current) => ({
						...current,
						user: { ...user, role: profile.role },
						defaults: profile.defaults,
						sugarDefaults: profile.sugarDefaults,
					}));
					setAccessDenied(profile.accessDenied);
					if (profile.needsOnboarding) {
						setOnboarding({
							company: profile.company ?? "",
							defaults: profile.defaults,
							sugarDefaults: profile.sugarDefaults,
							step: "morning",
						});
						setProfileReady(true);
						return null;
					}
					return getDrinkDay(todayKey).then((day) => {
						if (cancelled) return;
						setState((current) => ({
							...current,
							user: { ...user, role: profile.role },
							defaults: day.defaults,
							sugarDefaults: day.sugarDefaults,
							entries: { ...current.entries, [todayKey]: day.responses },
						}));
						setProfileReady(true);
						setError(null);
					});
				})
				.catch((reason: unknown) => {
					if (cancelled) return;
					if (isTransientFetchError(reason)) {
						setProfileReady(false);
						setError(null);
						window.setTimeout(loadProfile, 1500);
						return;
					}
					setProfileReady(true);
					setError(reportSentryError(reason, "Unable to load your profile"));
				});
		};
		loadProfile();
		return () => {
			cancelled = true;
		};
	}, [
		guestSession,
		localUser,
		sessionUserEmail,
		sessionUserId,
		sessionUserImage,
		sessionUserName,
		todayKey,
	]);
	useEffect(() => {
		if (!state.user?.role || state.user.role !== "admin" || view !== "admin")
			return;
		void getAdminDashboard()
			.then(setAdminData)
			.catch((reason: unknown) =>
				setError(reportSentryError(reason, "Unable to load admin view")),
			);
	}, [state.user?.role, view]);
	useEffect(() => {
		if ((!sessionUserId && !guestSession) || !profileReady || view !== "today")
			return;
		let cancelled = false;
		const refreshToday = () => {
			void getDrinkDay(todayKey)
				.then((day) => {
					if (cancelled) return;
					setState((current) => ({
						...current,
						defaults: day.defaults,
						sugarDefaults: day.sugarDefaults,
						entries: {
							...current.entries,
							[todayKey]: current.user
								? mergePendingPollResponses({
										serverPolls: day.responses,
										currentPolls: current.entries[todayKey] ?? [],
										user: current.user,
										defaults: current.defaults,
										sugarDefaults: current.sugarDefaults,
										pendingPeriods: pendingResponsePeriods.current,
									})
								: day.responses,
						},
					}));
					setError(null);
				})
				.catch((reason: unknown) => {
					if (!cancelled)
						setError(reportSentryError(reason, "Unable to refresh today"));
				});
		};
		const interval = window.setInterval(refreshToday, 4000);
		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	}, [guestSession, profileReady, sessionUserId, todayKey, view]);
	useEffect(() => {
		if (state.user?.role !== "admin" || view !== "admin") return;
		let cancelled = false;
		const refreshAdmin = () => {
			void getAdminDashboard()
				.then((data) => {
					if (!cancelled) setAdminData(data);
				})
				.catch((reason: unknown) => {
					if (!cancelled)
						setError(reportSentryError(reason, "Unable to refresh admin view"));
				});
		};
		const interval = window.setInterval(refreshAdmin, 4000);
		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	}, [state.user?.role, view]);
	useEffect(() => {
		if ((!sessionUserId && !guestSession) || view !== "history") return;
		let cancelled = false;
		void getDrinkDay(historyDate)
			.then((day) => {
				if (cancelled) return;
				setState((current) => ({
					...current,
					defaults: day.defaults,
					sugarDefaults: day.sugarDefaults,
					entries: { ...current.entries, [historyDate]: day.responses },
				}));
				setError(null);
			})
			.catch((reason: unknown) => {
				if (!cancelled)
					setError(reportSentryError(reason, "Unable to load history"));
			});
		return () => {
			cancelled = true;
		};
	}, [guestSession, historyDate, sessionUserId, view]);
	useEffect(() => {
		if (
			(!sessionUserId && !guestSession) ||
			!openPoll ||
			state.entries[openPoll.date]
		)
			return;
		let cancelled = false;
		void getDrinkDay(openPoll.date)
			.then((day) => {
				if (cancelled) return;
				setState((current) => ({
					...current,
					entries: { ...current.entries, [openPoll.date]: day.responses },
				}));
			})
			.catch((reason: unknown) => {
				if (!cancelled)
					setError(reportSentryError(reason, "Unable to load poll details"));
			});
		return () => {
			cancelled = true;
		};
	}, [guestSession, openPoll, sessionUserId, state.entries]);
	useEffect(() => {
		if (!openPoll) return;
		const scrollY = window.scrollY;
		document.body.style.top = `-${scrollY}px`;
		document.body.classList.add("modal-open");
		return () => {
			document.body.classList.remove("modal-open");
			document.body.style.top = "";
			window.scrollTo(0, scrollY);
		};
	}, [openPoll]);

	function signIn() {
		void authClient.signIn.social({ provider: "google", callbackURL: "/" });
	}
	function signOut() {
		if (guestSession) void leaveGuest();
		else void authClient.signOut();
		setGuestSession(null);
		setGuestSetup(false);
		setAccessDenied(false);
		setAdminData(null);
		setLocalUser(null);
		setSaveState({});
		pendingResponsePeriods.current.clear();
		setState((current) => ({ ...current, user: null }));
	}
	function signUpLocally() {
		setLocalUser(demoUser);
	}
	async function finishGuestSetup(name: string, company: Company) {
		try {
			const nextGuest = await createGuest({ name, company });
			setGuestSession(nextGuest);
			setGuestSetup(false);
			setError(null);
		} catch (reason: unknown) {
			setError(
				reason instanceof Error
					? reason.message
					: "Unable to start guest access",
			);
		}
	}
	async function finishOnboarding() {
		const currentOnboarding = onboarding;
		if (!currentOnboarding?.company) return;
		if (localUser) {
			const demoPolls = createDemoPolls(
				localUser,
				currentOnboarding.defaults,
				currentOnboarding.sugarDefaults,
			);
			setState({
				user: localUser,
				defaults: currentOnboarding.defaults,
				sugarDefaults: currentOnboarding.sugarDefaults,
				entries: {
					[todayKey]: demoPolls,
					[shiftDateKey(todayKey, -1)]: demoPolls,
				},
			});
			setOnboarding(null);
			return;
		}
		try {
			const profile = await completeOnboarding({
				company: currentOnboarding.company,
				defaults: currentOnboarding.defaults,
				sugarDefaults: currentOnboarding.sugarDefaults,
			});
			const day = await getDrinkDay(todayKey);
			setState((current) => ({
				...current,
				defaults: profile.defaults,
				sugarDefaults: profile.sugarDefaults,
				entries: { ...current.entries, [todayKey]: day.responses },
			}));
			setOnboarding(null);
			setError(null);
		} catch (reason: unknown) {
			setError(
				reason instanceof Error ? reason.message : "Unable to save your setup",
			);
		}
	}
	function persistResponse(period: Period, drink: Drink, sugar: boolean) {
		if (!state.user) return;
		const existing = state.entries[todayKey]?.find((entry) =>
			entry.user.id
				? entry.user.id === state.user?.id
				: entry.user.email === state.user?.email,
		);
		const previousDrink = existing?.choices[period] ?? state.defaults[period];
		const previousSugar =
			existing?.sugar[period] ?? state.sugarDefaults[period];
		const previousSource = existing?.sources[period] ?? "default";
		const version = saveVersion.current[period] + 1;
		saveVersion.current[period] = version;
		pendingResponsePeriods.current.add(period);

		setState((current) => {
			if (!current.user) return current;
			return {
				...current,
				entries: {
					...current.entries,
					[todayKey]: upsertPollResponse({
						polls: current.entries[todayKey] ?? [],
						user: current.user,
						defaults: current.defaults,
						sugarDefaults: current.sugarDefaults,
						period,
						drink,
						sugar,
					}),
				},
			};
		});
		setSaveState((current) => ({ ...current, [period]: "saving" }));
		if (localUser) {
			pendingResponsePeriods.current.delete(period);
			setSaveState((current) => ({ ...current, [period]: "saved" }));
			return;
		}

		void saveResponse({ date: todayKey, period, drink, sugar })
			.then((day) => {
				if (saveVersion.current[period] !== version) return;
				pendingResponsePeriods.current.delete(period);
				setState((current) => {
					const responses = current.user
						? mergePendingPollResponses({
								serverPolls: day.responses,
								currentPolls: current.entries[todayKey] ?? [],
								user: current.user,
								defaults: current.defaults,
								sugarDefaults: current.sugarDefaults,
								pendingPeriods: pendingResponsePeriods.current,
							})
						: day.responses;
					return {
						...current,
						defaults: day.defaults,
						sugarDefaults: day.sugarDefaults,
						entries: { ...current.entries, [todayKey]: responses },
					};
				});
				setSaveState((current) => ({ ...current, [period]: "saved" }));
				setError(null);
			})
			.catch((reason: unknown) => {
				if (saveVersion.current[period] !== version) return;
				pendingResponsePeriods.current.delete(period);
				setState((current) => {
					if (!current.user) return current;
					return {
						...current,
						entries: {
							...current.entries,
							[todayKey]: upsertPollResponse({
								polls: current.entries[todayKey] ?? [],
								user: current.user,
								defaults: current.defaults,
								sugarDefaults: current.sugarDefaults,
								period,
								drink: previousDrink,
								sugar: previousSugar,
								source: previousSource,
							}),
						},
					};
				});
				setSaveState((current) => {
					const next = { ...current };
					delete next[period];
					return next;
				});
				setError(reportSentryError(reason, "Unable to save your drink"));
			});
	}

	function updateEntry(period: Period, drink: Drink) {
		const existing = state.entries[todayKey]?.find((entry) =>
			entry.user.id
				? entry.user.id === state.user?.id
				: entry.user.email === state.user?.email,
		);
		const sugar = existing?.sugar[period] ?? state.sugarDefaults[period];
		persistResponse(period, drink, sugar);
	}

	function updateDefault(period: Period, drink: Drink, sugar: boolean) {
		const previousDrink = state.defaults[period];
		const previousSugar = state.sugarDefaults[period];
		setState((current) => ({
			...current,
			defaults: { ...current.defaults, [period]: drink },
			sugarDefaults: { ...current.sugarDefaults, [period]: sugar },
		}));
		if (localUser) return;
		void saveDefault({ period, drink, sugar })
			.then((settings) => {
				setState((current) => ({
					...current,
					defaults: settings.defaults,
					sugarDefaults: settings.sugarDefaults,
				}));
				setError(null);
			})
			.catch((reason: unknown) => {
				setState((current) => ({
					...current,
					defaults: { ...current.defaults, [period]: previousDrink },
					sugarDefaults: {
						...current.sugarDefaults,
						[period]: previousSugar,
					},
				}));
				setError(reportSentryError(reason, "Unable to save your default"));
			});
	}
	function updateSugar(period: Period, sugar: boolean) {
		const existing = state.entries[todayKey]?.find((entry) =>
			entry.user.id
				? entry.user.id === state.user?.id
				: entry.user.email === state.user?.email,
		);
		const drink = existing?.choices[period] ?? state.defaults[period];
		persistResponse(period, drink, sugar);
	}

	if (authPending || guestPending) return <AuthLoading />;
	if (signInError && !session?.user && !localUser && !guestSession)
		return <AccessDeniedPage authError />;
	if (!session?.user && !localUser && !guestSession)
		return guestSetup ? (
			<GuestSetupPage
				onSubmit={finishGuestSetup}
				onBack={() => {
					setGuestSetup(false);
					setError(null);
				}}
				error={error}
			/>
		) : (
			<SignInPage
				signIn={signIn}
				onGuest={() => {
					setGuestSetup(true);
					setError(null);
				}}
				onLocalSignUp={import.meta.env.DEV ? signUpLocally : undefined}
			/>
		);
	if (!state.user) return <AuthLoading />;
	if (!profileReady) return <AuthLoading message="Loading your workspace..." />;
	if (accessDenied) return <AccessDeniedPage onSignOut={signOut} />;
	if (guestSession?.status === "pending")
		return <GuestPendingPage onExit={signOut} />;
	if (guestSession?.status === "rejected")
		return <GuestRejectedPage onExit={signOut} />;
	if (onboarding)
		return (
			<OnboardingPage
				state={onboarding}
				setState={setOnboarding}
				onBack={signOut}
				onComplete={finishOnboarding}
				error={error}
			/>
		);
	const visiblePolls =
		view === "history" ? (state.entries[historyDate] ?? []) : todayPolls;
	const openPollData = openPoll ? (state.entries[openPoll.date] ?? []) : [];
	return (
		<ErrorBoundary fallback={AppErrorFallback}>
			<main
				className={cx(
					"min-h-svh bg-[#f6f5f1] text-[#2d2925] lg:pb-0",
					!isGuest && "pb-20",
				)}
			>
				<header className="border-b border-[#e6e0d6] bg-[#fffdf9]">
					<div className="mx-auto flex max-w-[1180px] items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
						<div className="flex items-center gap-2.5">
							<BrandMark />
							<span className="font-serif text-xl font-semibold tracking-[-0.02em]">
								MyBev
							</span>
							{localUser && (
								<span className="rounded-full bg-[#e7f0da] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#4e653b]">
									Demo
								</span>
							)}
						</div>
						<div className="relative">
							<button
								className="grid size-9 place-items-center rounded-full bg-[#dfc5a5] text-xs font-semibold text-[#5a3c26] transition hover:ring-2 hover:ring-[#a36f43]/40"
								onClick={() => setProfileOpen((open) => !open)}
								type="button"
								aria-label="Open profile"
								aria-expanded={profileOpen}
							>
								{initials(state.user.name)}
							</button>
							{profileOpen && (
								<div className="absolute right-0 top-11 z-20 w-64 rounded-2xl border border-[#e6e0d6] bg-[#fffdf9] p-4 shadow-xl">
									<p className="text-sm font-semibold text-[#33271f]">
										{state.user.name}
									</p>
									<p className="mt-1 break-words text-xs text-[#887f74]">
										{isGuest ? "Guest access" : state.user.email}
									</p>
									<button
										className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#5a3c26] text-sm font-semibold text-white transition hover:bg-[#68452e]"
										onClick={signOut}
										type="button"
									>
										<LogOut size={16} />
										Logout
									</button>
								</div>
							)}
						</div>
					</div>
				</header>
				{error && (
					<div className="mx-auto mt-4 max-w-[1180px] px-4 sm:px-6 lg:px-8">
						<div
							className="rounded-xl border border-[#e7cfc3] bg-[#fff5f0] px-3 py-2 text-sm text-[#8b4d35]"
							role="alert"
						>
							{error}
						</div>
					</div>
				)}
				<div
					className={cx(
						"mx-auto grid max-w-[1180px] gap-6 px-4 py-5 sm:px-6 lg:gap-10 lg:px-8 lg:py-8",
						!isGuest && "lg:grid-cols-[190px_1fr]",
					)}
				>
					{!isGuest && (
						<aside className="hidden lg:sticky lg:top-8 lg:h-fit lg:block">
							<Nav
								admin={state.user.role === "admin"}
								view={view}
								setView={setView}
							/>
						</aside>
					)}
					<section className="min-w-0">
						{view === "today" && (
							<TodayView
								guest={isGuest}
								entry={todaysEntry}
								saveState={saveState}
								sugar={todaysSugar}
								todayPolls={todayPolls}
								userName={state.user.name}
								updateEntry={updateEntry}
								updateSugar={updateSugar}
								onOpen={(period) => setOpenPoll({ date: todayKey, period })}
							/>
						)}
						{view === "history" && (
							<HistoryView
								date={historyDate}
								setDate={setHistoryDate}
								polls={visiblePolls}
							/>
						)}
						{view === "defaults" && (
							<DefaultsView
								defaults={state.defaults}
								sugarDefaults={state.sugarDefaults}
								updateDefault={updateDefault}
							/>
						)}
						{view === "admin" && (
							<AdminView
								data={adminData}
								onRefresh={() => void getAdminDashboard().then(setAdminData)}
							/>
						)}
					</section>
				</div>
				{!isGuest && (
					<div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#e6e0d6] bg-[#fffdf9]/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur sm:px-4 lg:hidden">
						<Nav
							admin={state.user.role === "admin"}
							view={view}
							setView={setView}
						/>
					</div>
				)}
				{openPoll && (
					<PollDetailsSheet
						date={openPoll.date}
						period={openPoll.period}
						polls={openPollData}
						onClose={() => setOpenPoll(null)}
					/>
				)}
			</main>
		</ErrorBoundary>
	);
}

function GuestSetupPage({
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
		<main className="grid min-h-svh place-items-center bg-[#f6f5f1] px-5 py-10 text-[#33271f]">
			<section className="w-full max-w-sm rounded-3xl bg-[#fffdf9] p-6 shadow-[0_20px_60px_rgba(77,57,38,0.1)] sm:p-8">
				<h1 className="font-serif text-3xl">
					{step === "name" ? "What is your name?" : "Choose your company"}
				</h1>
				{error && (
					<p
						className="mt-4 rounded-xl border border-[#e7cfc3] bg-[#fff5f0] px-3 py-2 text-sm text-[#8b4d35]"
						role="alert"
					>
						{error}
					</p>
				)}
				{step === "name" ? (
					<>
						<label className="mt-7 block text-sm font-semibold text-[#33271f]">
							Name
							<input
								className="mt-2 h-12 w-full rounded-xl border border-[#e6e0d6] bg-[#fffdf9] px-3 text-sm outline-none transition focus:border-[#a36f43]"
								onChange={(event) => setName(event.target.value)}
								placeholder="Your name"
								value={name}
							/>
						</label>
						<div className="mt-7 flex gap-2">
							<button
								onClick={back}
								type="button"
								className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#e6e0d6] px-3 text-sm font-semibold text-[#68452e]"
							>
								<ArrowLeft size={16} />
								Back
							</button>
							<button
								disabled={name.trim().length < 2}
								onClick={() => setStep("company")}
								type="button"
								className="flex min-h-11 flex-[1.5] items-center justify-center gap-2 rounded-xl bg-[#5a3c26] px-3 text-sm font-semibold text-white transition hover:bg-[#68452e] disabled:cursor-not-allowed disabled:opacity-45"
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
											? "border-[#a36f43] bg-[#f6ece1] text-[#68452e]"
											: "border-[#eee8df] text-[#665b50] hover:border-[#dbc9b6]",
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
								className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#e6e0d6] px-3 text-sm font-semibold text-[#68452e]"
							>
								<ArrowLeft size={16} />
								Back
							</button>
							<button
								disabled={!company}
								onClick={() => onSubmit(name.trim(), company)}
								type="button"
								className="min-h-11 flex-[1.5] rounded-xl bg-[#5a3c26] px-3 text-sm font-semibold text-white transition hover:bg-[#68452e] disabled:cursor-not-allowed disabled:opacity-45"
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
function AdminView({
	data,
	onRefresh,
}: {
	data: AdminDashboard | null;
	onRefresh: () => void;
}) {
	const [openUserId, setOpenUserId] = useState<string | null>(null);
	if (!data) return <AuthLoading message="Loading admin view..." />;
	return (
		<div className="grid gap-5">
			<PageHeader
				eyebrow="Admin"
				title="Manage today"
				action={
					data.pendingGuests.length
						? `${data.pendingGuests.length} pending`
						: "No pending guests"
				}
			/>
			{data.pendingGuests.length > 0 && (
				<section className="rounded-2xl border border-[#e6e0d6] bg-[#fffdf9] p-4">
					<h2 className="text-sm font-semibold text-[#33271f]">
						Guest requests
					</h2>
					<div className="mt-3 grid gap-2">
						{data.pendingGuests.map((guest) => (
							<div
								className="flex items-center justify-between gap-3 rounded-xl bg-[#f8f5f0] px-3 py-3"
								key={guest.id}
							>
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold">{guest.name}</p>
									<p className="text-xs text-[#887f74]">
										{guest.company ?? "Unknown company"}
									</p>
								</div>
								<div className="flex shrink-0 gap-2">
									<button
										onClick={() =>
											void updateGuestRequest({
												type: "reject",
												userId: guest.id,
											}).then(onRefresh)
										}
										type="button"
										className="min-h-9 rounded-lg border border-[#e6e0d6] px-3 text-xs font-semibold text-[#68452e]"
									>
										Decline
									</button>
									<button
										onClick={() =>
											void updateGuestRequest({
												type: "approve",
												userId: guest.id,
											}).then(onRefresh)
										}
										type="button"
										className="min-h-9 rounded-lg bg-[#5a3c26] px-3 text-xs font-semibold text-white"
									>
										Approve
									</button>
								</div>
							</div>
						))}
					</div>
				</section>
			)}
			<section className="rounded-2xl border border-[#e6e0d6] bg-[#fffdf9] p-4">
				<h2 className="text-sm font-semibold text-[#33271f]">
					Today’s choices
				</h2>
				<div className="mt-3 grid gap-3">
					{data.responses.map((poll) => {
						const rowId = poll.user.id ?? poll.user.email;
						return (
							<AdminResponseRow
								expanded={openUserId === rowId}
								key={rowId}
								poll={poll}
								onRefresh={onRefresh}
								onToggle={() =>
									setOpenUserId((current) => (current === rowId ? null : rowId))
								}
							/>
						);
					})}
				</div>
			</section>
		</div>
	);
}
function AdminResponseRow({
	poll,
	expanded,
	onToggle,
	onRefresh,
}: {
	poll: PollRecord;
	expanded: boolean;
	onToggle: () => void;
	onRefresh: () => void;
}) {
	const update = (period: Period, drink: Drink, sugar = poll.sugar[period]) => {
		if (!poll.user.id) return;
		void updateUserResponse({
			userId: poll.user.id,
			period,
			drink,
			sugar: drink === "No drink" ? true : sugar,
		}).then(onRefresh);
	};
	const removeGuest = () => {
		if (!poll.user.id) return;
		void updateGuestRequest({ type: "removeGuest", userId: poll.user.id }).then(
			onRefresh,
		);
	};
	return (
		<article className="rounded-xl bg-[#f8f5f0] p-3">
			<button
				onClick={onToggle}
				type="button"
				className="flex min-h-10 w-full items-center justify-between gap-3 text-left"
			>
				<div className="min-w-0">
					<p className="truncate text-sm font-semibold">
						{compactName(poll.user)}
					</p>
					<p className="mt-1 truncate text-xs text-[#887f74]">
						Morning: {poll.choices.morning} · Evening: {poll.choices.evening}
					</p>
				</div>
				<ChevronRight
					className={cx(
						"shrink-0 text-[#887f74] transition",
						expanded && "rotate-90",
					)}
					size={16}
				/>
			</button>
			{expanded && (
				<div className="mt-3 border-t border-[#e6e0d6] pt-3">
					<div className="grid gap-3 sm:grid-cols-2">
						{periods.map((period) => (
							<AdminPeriodControl
								key={period}
								period={period}
								drink={poll.choices[period]}
								sugar={poll.sugar[period]}
								source={poll.sources[period]}
								onDrinkChange={(drink) => update(period, drink)}
								onSugarChange={(sugar) =>
									update(period, poll.choices[period], sugar)
								}
							/>
						))}
					</div>
					{isGuestUser(poll.user) && (
						<button
							onClick={removeGuest}
							type="button"
							className="mt-3 min-h-9 rounded-lg border border-[#e7cfc3] px-3 text-xs font-semibold text-[#8b4d35]"
						>
							Remove guest
						</button>
					)}
				</div>
			)}
		</article>
	);
}
function AdminPeriodControl({
	period,
	drink,
	sugar,
	source,
	onDrinkChange,
	onSugarChange,
}: {
	period: Period;
	drink: Drink;
	sugar: boolean;
	source: PollSource;
	onDrinkChange: (drink: Drink) => void;
	onSugarChange: (sugar: boolean) => void;
}) {
	return (
		<section className="rounded-xl border border-[#eee8df] bg-[#fffdf9] p-3">
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-xs font-semibold text-[#887f74]">
					{period === "morning" ? "Morning" : "Evening"}
				</h3>
				<MetaTag muted>{sourceLabel(source)}</MetaTag>
			</div>
			<select
				className="mt-2 h-10 w-full rounded-lg border border-[#e6e0d6] bg-[#fffdf9] px-2 text-sm font-semibold text-[#68452e]"
				onChange={(event) => onDrinkChange(event.target.value as Drink)}
				value={drink}
			>
				{drinks.map((item) => (
					<option key={item}>{item}</option>
				))}
			</select>
			<div className="mt-3 flex min-h-7 items-center justify-between gap-3">
				<SugarToggle
					compact
					disabled={drink === "No drink"}
					sugar={sugar}
					onChange={onSugarChange}
				/>
			</div>
		</section>
	);
}

function Nav({
	view,
	setView,
	admin = false,
}: {
	view: View;
	setView: (view: View) => void;
	admin?: boolean;
}) {
	const items: Array<{ id: View; label: string; icon: React.ReactNode }> = [
		{ id: "today", label: "Today", icon: <CalendarDays size={18} /> },
		{ id: "history", label: "History", icon: <History size={18} /> },
		{
			id: "defaults",
			label: "Defaults",
			icon: <SlidersHorizontal size={18} />,
		},
		...(!admin
			? []
			: [
					{
						id: "admin" as View,
						label: "Admin",
						icon: <ShieldCheck size={18} />,
					},
				]),
	];
	return (
		<nav
			className={cx(
				"grid gap-2 lg:grid-cols-1",
				admin ? "grid-cols-4" : "grid-cols-3",
			)}
		>
			{items.map((item) => (
				<button
					key={item.id}
					onClick={() => setView(item.id)}
					type="button"
					className={cx(
						"flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-semibold transition lg:flex-row lg:justify-start lg:gap-2 lg:px-3 lg:text-sm",
						view === item.id
							? "bg-[#5a3c26] text-white"
							: "text-[#887f74] hover:bg-[#f1ede6] hover:text-[#5a3c26]",
					)}
				>
					{item.icon}
					<span>{item.label}</span>
					{view === item.id && (
						<ChevronRight className="ml-auto hidden lg:block" size={15} />
					)}
				</button>
			))}
		</nav>
	);
}
function BrandMark({
	className = "size-8",
	iconSize = 17,
	iconColor = "currentColor",
}: {
	className?: string;
	iconSize?: number;
	iconColor?: string;
}) {
	return (
		<div
			className={cx(
				"grid place-items-center rounded-[10px] bg-[#5a3c26] text-[#fff9ef]",
				className,
			)}
		>
			<Coffee color={iconColor} size={iconSize} strokeWidth={2.2} />
		</div>
	);
}

function AuthLoading({
	message = "Checking your account...",
}: {
	message?: string;
}) {
	return (
		<main className="grid min-h-svh place-items-center bg-[#f6f5f1]">
			<output
				aria-label={message}
				className="size-10 animate-spin rounded-full border-2 border-[#e6e0d6] border-t-[#5a3c26]"
			/>
		</main>
	);
}
function SignInPage({
	signIn,
	onGuest,
	onLocalSignUp,
}: {
	signIn: () => void;
	onGuest: () => void;
	onLocalSignUp?: () => void;
}) {
	return (
		<main className="relative grid min-h-svh place-items-center overflow-hidden bg-[#f6f5f1] px-5 py-10 text-[#fff9ef]">
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
			<section className="relative z-10 flex w-full max-w-sm flex-col items-center rounded-3xl bg-[#5a3c26] px-6 py-9 text-center shadow-[0_20px_60px_rgba(77,57,38,0.2)] sm:px-8">
				<BrandMark
					className="size-16 rounded-[18px] bg-[#fff9ef] text-[#5a3c26]"
					iconColor="#5a3c26"
					iconSize={30}
				/>
				<h1 className="mt-7 font-serif text-5xl leading-tight">MyBev</h1>
				<p className="mt-4 max-w-xs text-[15px] leading-6 text-[#e7d8c4]">
					One shared order. Zero drink-round chaos.
				</p>
				<button
					onClick={signIn}
					type="button"
					className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#fff9ef] text-sm font-semibold text-[#5a3c26] shadow-[0_12px_30px_rgba(38,24,16,0.22)] transition hover:bg-white"
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
						className="mt-3 rounded-full border border-[#a98568] px-3 py-1.5 text-xs font-semibold text-[#f2e6d8] transition hover:bg-white/10"
					>
						Explore interactive demo
					</button>
				)}
			</section>
		</main>
	);
}

function AccessDeniedPage({
	authError = false,
	onSignOut,
}: {
	authError?: boolean;
	onSignOut?: () => void;
}) {
	return (
		<main className="grid min-h-svh place-items-center bg-[#f6f5f1] px-5 text-[#33271f]">
			<section className="w-full max-w-sm rounded-3xl bg-[#fffdf9] p-8 text-center shadow-[0_20px_60px_rgba(77,57,38,0.1)]">
				<h1 className="font-serif text-3xl">Work email not recognized</h1>
				<p className="mt-3 text-sm leading-6 text-[#887f74]">
					Use an email from a registered company, or request guest access from a
					company administrator.
				</p>
				{authError ? (
					<a
						href="/"
						className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-[#5a3c26] px-5 text-sm font-semibold text-white"
					>
						Back to MyBev
					</a>
				) : (
					<button
						onClick={onSignOut}
						type="button"
						className="mt-7 min-h-11 rounded-xl bg-[#5a3c26] px-5 text-sm font-semibold text-white"
					>
						Sign out
					</button>
				)}
			</section>
		</main>
	);
}
function GuestPendingPage({ onExit }: { onExit: () => void }) {
	return (
		<main className="grid min-h-svh place-items-center bg-[#f6f5f1] px-5 text-[#33271f]">
			<section className="w-full max-w-sm rounded-3xl bg-[#fffdf9] p-8 text-center shadow-[0_20px_60px_rgba(77,57,38,0.1)]">
				<h1 className="font-serif text-3xl">Waiting for approval</h1>
				<p className="mt-3 text-sm leading-6 text-[#887f74]">
					A company admin needs to approve your guest request before you can
					join today’s polls.
				</p>
				<button
					onClick={onExit}
					type="button"
					className="mt-7 min-h-11 rounded-xl border border-[#e6e0d6] px-5 text-sm font-semibold text-[#68452e]"
				>
					Exit guest access
				</button>
			</section>
		</main>
	);
}
function GuestRejectedPage({ onExit }: { onExit: () => void }) {
	return (
		<main className="grid min-h-svh place-items-center bg-[#f6f5f1] px-5 text-[#33271f]">
			<section className="w-full max-w-sm rounded-3xl bg-[#fffdf9] p-8 text-center shadow-[0_20px_60px_rgba(77,57,38,0.1)]">
				<h1 className="font-serif text-3xl">Guest request declined</h1>
				<p className="mt-3 text-sm leading-6 text-[#887f74]">
					Ask the company admin to approve your guest access.
				</p>
				<button
					onClick={onExit}
					type="button"
					className="mt-7 min-h-11 rounded-xl border border-[#e6e0d6] px-5 text-sm font-semibold text-[#68452e]"
				>
					Exit guest access
				</button>
			</section>
		</main>
	);
}

function OnboardingPage({
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
		<main className="flex min-h-svh items-center justify-center bg-[#f6f5f1] px-4 py-8 text-[#33271f]">
			<div className="mx-auto w-full max-w-lg">
				<h1 className="mb-5 font-serif text-2xl leading-tight text-[#33271f]">
					Choose your {period.label.toLowerCase()} default
				</h1>
				<section className="rounded-3xl bg-[#fffdf9] p-5 shadow-[0_20px_60px_rgba(77,57,38,0.1)] sm:p-8">
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
							className="mt-3 rounded-xl border border-[#e7cfc3] bg-[#fff5f0] px-3 py-2 text-sm text-[#8b4d35]"
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
										? "border-[#a36f43] bg-[#f6ece1] text-[#68452e]"
										: "border-[#eee8df] text-[#665b50] hover:border-[#dbc9b6]",
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
							className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#e6e0d6] px-3 text-sm font-semibold text-[#68452e]"
						>
							<ArrowLeft size={16} />
							Back
						</button>
						<button
							disabled={!state.defaults[period.id]}
							onClick={next}
							type="button"
							className="flex min-h-11 flex-[1.5] items-center justify-center gap-2 rounded-xl bg-[#5a3c26] px-4 text-sm font-semibold text-white transition hover:bg-[#68452e] disabled:cursor-not-allowed disabled:opacity-45"
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
function TodayView({
	entry,
	saveState,
	sugar,
	todayPolls,
	userName,
	updateEntry,
	updateSugar,
	onOpen,
	guest = false,
}: {
	entry: DrinkChoice;
	saveState: Partial<Record<Period, "saving" | "saved">>;
	sugar: SugarChoice;
	todayPolls: PollRecord[];
	userName: string;
	updateEntry: (period: Period, drink: Drink) => void;
	updateSugar: (period: Period, sugar: boolean) => void;
	onOpen: (period: Period) => void;
	guest?: boolean;
}) {
	return (
		<div className="grid gap-6">
			<PageHeader
				eyebrow={displayDate(getDateKey())}
				title="Today"
				action={`${todayPolls.length} people`}
			/>
			<BrewSummary polls={todayPolls} userName={userName} />
			<div className="grid gap-4 xl:grid-cols-2">
				{periodDetails.map((period) => (
					<DrinkPoll
						key={period.id}
						period={period}
						polls={todayPolls}
						saveState={saveState[period.id]}
						selected={entry[period.id]}
						sugar={sugar[period.id]}
						editable
						onSelect={(drink) => updateEntry(period.id, drink)}
						onToggleSugar={(next) => updateSugar(period.id, next)}
						onOpen={guest ? undefined : () => onOpen(period.id)}
					/>
				))}
			</div>
		</div>
	);
}
function HistoryView({
	date,
	setDate,
	polls,
}: {
	date: string;
	setDate: (date: string) => void;
	polls: PollRecord[];
}) {
	const nextDate = shiftDateKey(date, 1);
	const canMoveForward = nextDate < getDateKey();
	return (
		<div className="grid gap-5">
			<PageHeader
				eyebrow="History"
				title={displayDate(date)}
				action={polls.length ? `${polls.length} people` : "No responses"}
			/>
			<div className="flex items-center justify-between gap-3 rounded-2xl border border-[#e6e0d6] bg-[#fffdf9] p-2">
				<button
					onClick={() => setDate(shiftDateKey(date, -1))}
					type="button"
					className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#68452e] transition hover:bg-[#f1ede6]"
				>
					<ArrowLeft size={16} />
					Previous
				</button>
				<button
					disabled={!canMoveForward}
					onClick={() => setDate(nextDate)}
					type="button"
					className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#68452e] transition hover:bg-[#f1ede6] disabled:cursor-not-allowed disabled:opacity-45"
				>
					Next
					<ArrowRight size={16} />
				</button>
			</div>
			<HistoryResponseCards polls={polls} />
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
	if (!polls.length)
		return (
			<div className="rounded-2xl border border-dashed border-[#dbcfc1] bg-[#fffdf9] px-4 py-8 text-center text-sm text-[#887f74]">
				No responses for this day.
			</div>
		);
	return (
		<div className="grid gap-3">
			{rows.map((group) => (
				<article
					className="overflow-hidden rounded-2xl border border-[#e6e0d6] bg-[#fffdf9] shadow-[0_8px_30px_rgba(77,57,38,0.04)]"
					key={group.drink}
				>
					<button
						onClick={() =>
							setOpenDrink((current) =>
								current === group.drink ? null : group.drink,
							)
						}
						type="button"
						className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left"
					>
						<span className="text-sm font-semibold text-[#33271f]">
							{group.drink}
						</span>
						<span className="text-xs font-semibold text-[#887f74]">
							{group.entries.length}
						</span>
					</button>
					{openDrink === group.drink && (
						<div className="grid gap-2 border-t border-[#eee8df] p-3">
							{group.entries.map((entry) => (
								<div
									className="flex items-center justify-between gap-3 rounded-xl bg-[#f8f5f0] px-3 py-2.5"
									key={`${entry.user.email}-${entry.period}`}
								>
									<div className="flex min-w-0 items-center gap-2.5">
										<span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#eee1d1] text-[11px] font-semibold text-[#68452e]">
											{initials(compactName(entry.user))}
										</span>
										<div className="min-w-0">
											<p className="truncate text-sm font-semibold">
												{compactName(entry.user)}
											</p>
											<p className="text-xs text-[#887f74]">
												{entry.period === "morning" ? "Morning" : "Evening"}
											</p>
										</div>
									</div>
									<span className="flex shrink-0 flex-wrap justify-end gap-1">
										<MetaTag>{entry.sugar ? "Sugar" : "No sugar"}</MetaTag>
										<MetaTag muted>{sourceLabel(entry.source)}</MetaTag>
									</span>
								</div>
							))}
						</div>
					)}
				</article>
			))}
		</div>
	);
}
function DefaultsView({
	defaults,
	sugarDefaults,
	updateDefault,
}: {
	defaults: DrinkChoice;
	sugarDefaults: SugarChoice;
	updateDefault: (period: Period, drink: Drink, sugar: boolean) => void;
}) {
	return (
		<div className="grid gap-5">
			<PageHeader eyebrow="Defaults" title="Choose drinks" />
			<div className="grid gap-3">
				{periodDetails.map((period) => (
					<DefaultDrinkSetting
						key={period.id}
						period={period}
						selected={defaults[period.id]}
						sugar={sugarDefaults[period.id]}
						onSelect={(drink) =>
							updateDefault(period.id, drink, sugarDefaults[period.id])
						}
						onToggleSugar={(sugar) =>
							updateDefault(period.id, defaults[period.id], sugar)
						}
					/>
				))}
			</div>
		</div>
	);
}
function DefaultDrinkSetting({
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
		<section className="rounded-2xl border border-[#e6e0d6] bg-[#fffdf9] p-4 shadow-[0_8px_30px_rgba(77,57,38,0.04)] sm:p-5">
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-start gap-3">
					<span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f1ede6] text-[#a36f43]">
						<Coffee size={17} />
					</span>
					<h2 className="pt-1 text-sm font-semibold text-[#33271f]">
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
					<button
						key={drink}
						onClick={() => onSelect(drink)}
						type="button"
						className={cx(
							"flex min-h-11 items-center justify-between rounded-xl border px-3 text-left text-sm font-semibold transition",
							selected === drink
								? "border-[#a36f43] bg-[#f6ece1] text-[#68452e]"
								: "border-[#eee8df] text-[#665b50] hover:border-[#dbc9b6]",
						)}
					>
						{drink}
						{selected === drink && <Check size={15} />}
					</button>
				))}
			</div>
		</section>
	);
}
function PageHeader({
	eyebrow,
	title,
	action,
}: {
	eyebrow: string;
	title: string;
	action?: string;
}) {
	return (
		<div className="flex items-end justify-between gap-4 border-b border-[#e6e0d6] pb-4">
			<div>
				<p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a36f43]">
					{eyebrow}
				</p>
				<h1 className="mt-1 font-serif text-3xl tracking-[-0.03em] text-[#33271f] sm:text-4xl">
					{title}
				</h1>
			</div>
			{action && (
				<span className="shrink-0 text-xs font-semibold text-[#9a9084]">
					{action}
				</span>
			)}
		</div>
	);
}

function SugarToggle({
	sugar,
	onChange,
	compact = false,
	disabled = false,
}: {
	sugar: boolean;
	onChange: (sugar: boolean) => void;
	compact?: boolean;
	disabled?: boolean;
}) {
	return (
		<button
			aria-label="Sugar Free"
			aria-pressed={!sugar}
			disabled={disabled}
			className={cx(
				compact
					? "flex shrink-0 items-center gap-2 text-xs font-semibold text-[#68452e]"
					: "mt-3 flex min-h-10 w-full items-center justify-between rounded-xl border border-[#e6e0d6] px-3 text-left transition hover:border-[#a36f43]",
				disabled && "cursor-not-allowed opacity-45",
			)}
			onClick={() => onChange(!sugar)}
			type="button"
		>
			<span className={cx(compact ? "whitespace-nowrap" : "")}>
				<span
					className={cx("block font-semibold", compact ? "text-xs" : "text-sm")}
				>
					Sugar Free
				</span>
				{!compact && (
					<span className="block text-xs text-[#9a9084]">
						{sugar ? "Off" : "On"}
					</span>
				)}
			</span>
			<span
				className={cx(
					"relative h-6 w-11 rounded-full transition",
					sugar ? "bg-[#d8cec2]" : "bg-[#a36f43]",
				)}
			>
				<span
					className={cx(
						"absolute top-1 size-4 rounded-full bg-white transition",
						sugar ? "left-1" : "left-6",
					)}
				/>
			</span>
		</button>
	);
}
function DrinkPoll({
	period,
	polls,
	saveState,
	selected,
	sugar,
	editable,
	onSelect,
	onToggleSugar,
	onOpen,
}: {
	period: { id: Period; label: string; helper: string };
	polls: PollRecord[];
	saveState?: "saving" | "saved";
	selected?: Drink;
	sugar: boolean;
	editable: boolean;
	onSelect?: (drink: Drink) => void;
	onToggleSugar?: (sugar: boolean) => void;
	onOpen?: () => void;
}) {
	const counts = countChoices(polls)[period.id];
	const total = polls.length;
	return (
		<section
			aria-label={`${period.label} drink choices`}
			className="overflow-hidden rounded-[24px] border border-[#e6e0d6] bg-[#fffdf9] shadow-[0_12px_36px_rgba(77,57,38,0.06)]"
		>
			<div className="flex items-start justify-between gap-4 border-b border-[#eee8df] px-4 py-4 sm:px-5">
				<span className="flex items-center gap-2.5">
					<span className="grid size-9 place-items-center rounded-xl bg-[#f1ede6] text-[#a36f43]">
						<Coffee size={16} />
					</span>
					<span>
						<span className="block text-sm font-semibold text-[#33271f]">
							{period.label}
						</span>
						<span className="block text-xs text-[#9a9084]">
							{period.helper}
						</span>
					</span>
				</span>
				<div className="flex flex-col items-end gap-2">
					<SugarToggle
						compact
						disabled={selected === "No drink"}
						sugar={sugar}
						onChange={onToggleSugar ?? (() => undefined)}
					/>
					<SaveStatus state={saveState} />
				</div>
			</div>
			<div className="grid grid-cols-2 gap-2.5 p-3 sm:p-4">
				{drinks.map((drink) => {
					const count = counts[drink];
					const percent = total ? Math.round((counts[drink] / total) * 100) : 0;
					return (
						<button
							aria-pressed={selected === drink}
							key={drink}
							disabled={!editable}
							onClick={() => onSelect?.(drink)}
							type="button"
							className={cx(
								"relative flex min-h-[76px] items-center gap-2.5 overflow-hidden rounded-2xl border p-2.5 text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#a36f43] focus-visible:ring-offset-2",
								drink === "No drink" && "col-span-2",
								selected === drink && "pr-8",
								editable
									? "transition hover:-translate-y-0.5 hover:border-[#dbc9b6] hover:shadow-sm"
									: "cursor-default",
								selected === drink
									? "border-[#a36f43] bg-[#fbf0e5] text-[#68452e] shadow-[inset_0_0_0_1px_#a36f43]"
									: "border-[#eee8df] text-[#665b50]",
							)}
						>
							<span
								aria-hidden="true"
								className="absolute bottom-0 left-0 h-1 bg-[#ead8c7]"
								style={{
									width: `${percent}%`,
								}}
							/>
							<DrinkGlyph drink={drink} />
							<span className="relative min-w-0 flex-1">
								<span className="block text-[13px] leading-4">{drink}</span>
								<span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9a9084]">
									{count} {count === 1 ? "pick" : "picks"}
								</span>
							</span>
							{selected === drink && (
								<span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-[#a36f43] text-white">
									<Check size={13} strokeWidth={3} />
								</span>
							)}
						</button>
					);
				})}
			</div>
			{onOpen && (
				<button
					className="mx-3 mb-3 flex min-h-11 w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-xl border border-[#dfd5c9] bg-[#f8f5f0] text-sm font-semibold text-[#68452e] transition hover:border-[#cdb9a4] hover:bg-[#f3ece4] sm:mx-4 sm:mb-4 sm:w-[calc(100%-2rem)]"
					onClick={onOpen}
					type="button"
				>
					<Eye size={16} />
					View {period.label.toLowerCase()} order · {total}
				</button>
			)}
		</section>
	);
}

function PollDetailsSheet({
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
	const [query, setQuery] = useState("");
	const periodInfo = periodDetails.find((item) => item.id === period);
	const sourcePolls =
		sourceFilter === "all"
			? polls
			: polls.filter((item) => item.sources[period] === sourceFilter);
	const normalizedQuery = query.trim().toLowerCase();
	const filteredPolls = normalizedQuery
		? sourcePolls.filter((item) =>
				item.user.name.toLowerCase().includes(normalizedQuery),
			)
		: sourcePolls;
	useEffect(() => {
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", closeOnEscape);
		return () => window.removeEventListener("keydown", closeOnEscape);
	}, [onClose]);
	return (
		<div className="fixed inset-0 z-30 flex items-end overscroll-none bg-[#2d2925]/10 p-0 sm:items-center sm:justify-center sm:p-4">
			<button
				className="absolute inset-0 cursor-default bg-[#2d2925]/30 [touch-action:none]"
				onClick={onClose}
				type="button"
				aria-label="Close poll details"
			/>
			<section
				aria-labelledby="poll-details-title"
				aria-modal="true"
				className="relative z-10 flex max-h-[88svh] min-h-0 w-full flex-col rounded-t-3xl bg-[#fffdf9] px-4 pb-6 pt-3 shadow-2xl overscroll-contain sm:max-w-lg sm:rounded-2xl sm:p-6"
				role="dialog"
			>
				<div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-[#ddd3c7] sm:hidden" />
				<div className="shrink-0 border-b border-[#eee8df] pb-4">
					<div className="flex items-start justify-between">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a36f43]">
								{date === getDateKey() ? "Today" : displayDate(date)}
							</p>
							<h2
								className="mt-1 font-serif text-2xl text-[#33271f]"
								id="poll-details-title"
							>
								{periodInfo?.label ?? period}
							</h2>
							<p className="mt-1 text-sm text-[#9a9084]">
								{filteredPolls.length}{" "}
								{filteredPolls.length === 1 ? "response" : "responses"}
							</p>
						</div>
						<button
							className="grid size-9 place-items-center rounded-full bg-[#f1ede6] text-[#887f74]"
							onClick={onClose}
							type="button"
							aria-label="Close poll details"
						>
							<X size={18} />
						</button>
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
										? "border-[#5a3c26] bg-[#5a3c26] text-white"
										: "border-[#e6e0d6] text-[#887f74] hover:bg-[#f1ede6]",
								)}
							>
								{filter === "all" ? "All" : sourceLabel(filter)}
							</button>
						))}
					</div>
					<label className="relative mt-3 block">
						<span className="sr-only">Search people</span>
						<Search
							aria-hidden="true"
							className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9a9084]"
							size={16}
						/>
						<input
							className="h-10 w-full rounded-xl border border-[#e6e0d6] bg-[#f8f5f0] pl-9 pr-3 text-sm outline-none transition placeholder:text-[#aaa096] focus:border-[#a36f43] focus:bg-white"
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search people"
							type="search"
							value={query}
						/>
					</label>
				</div>
				<div className="mt-5 min-h-0 flex-1 grid gap-5 overflow-y-auto overscroll-contain pr-1 [touch-action:pan-y]">
					{filteredPolls.length === 0 && (
						<div className="rounded-2xl border border-dashed border-[#dbcfc1] px-4 py-8 text-center text-sm text-[#887f74]">
							No matching responses.
						</div>
					)}
					{drinks.map((drink) => {
						const drinkPolls = filteredPolls.filter(
							(item) => item.choices[period] === drink,
						);
						const sugarFreeCount = drinkPolls.filter(
							(item) => !item.sugar[period],
						).length;
						if (!drinkPolls.length) return null;
						return (
							<section key={drink}>
								<h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-[#5a3c26]">
									{drink}
									<span className="text-sm font-semibold text-[#9a9084]">
										{drinkPolls.length}
										{sugarFreeCount ? ` (${sugarFreeCount} SF)` : ""}
									</span>
								</h3>
								<div className="grid gap-2">
									{drinkPolls.map((item) => (
										<div
											className="flex items-center justify-between gap-3 rounded-xl bg-[#f8f5f0] px-3 py-2.5"
											key={item.user.email}
										>
											<div className="flex min-w-0 items-center gap-2.5">
												<span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#eee1d1] text-[11px] font-semibold text-[#68452e]">
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
				</div>
			</section>
		</div>
	);
}

export default App;
