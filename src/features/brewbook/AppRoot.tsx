import { ErrorBoundary } from "@sentry/react";
import { useEffect, useRef, useState } from "react";
import { authClient } from "#/lib/auth-client";
import {
	type AdminDashboard,
	type AttendanceStatus,
	type Company,
	completeOnboarding,
	createGuest,
	type Drink,
	type GuestSession,
	getAdminDashboard,
	getDrinkDay,
	getGuestSession,
	getProfile,
	leaveGuest,
	type Period,
	saveDefault,
	saveResponse,
	setAvailability,
	type User,
} from "#/lib/drinks";
import { initSentryClient, syncSentryUser } from "#/lib/sentry";
import { AdminView } from "./components/admin";
import {
	AccessDeniedPage,
	AuthLoading,
	GuestPendingPage,
	GuestRejectedPage,
	GuestSetupPage,
	LocalSetupComplete,
	OnboardingPage,
	SignInPage,
} from "./components/auth";
import { BrandMark, Nav } from "./components/navigation";
import { GlassEasterEgg, PollDetailsSheet } from "./components/overlays";
import { ProfileView } from "./components/profile";
import { StatsView } from "./components/stats";
import { TodayView } from "./components/today";
import { brewingMessages, initialState, todayKey } from "./constants";
import { useTheme } from "./hooks/use-theme";
import type { AppState, OnboardingState, OpenPoll, View } from "./types";
import {
	authErrorMessage,
	cx,
	isTransientFetchError,
	pickRandom,
	reportSentryError,
} from "./utils";

initSentryClient();

if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
	void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}

const readState = () => initialState;
function AppErrorFallback() {
	return (
		<main className="grid min-h-svh place-items-center bg-[var(--c-page)] px-5 text-[var(--c-text-dark)]">
			<section className="w-full max-w-sm rounded-3xl bg-[var(--c-card)] p-8 text-center shadow-[0_20px_60px_rgba(77,57,38,0.1)]">
				<h1 className="font-serif text-3xl">Something went wrong</h1>
				<p className="mt-3 text-sm leading-6 text-[var(--c-text-muted)]">
					BrewBook hit an unexpected error. Refresh the page or try again in a
					moment.
				</p>
			</section>
		</main>
	);
}

export default App;

function App() {
	const { dark, toggle: toggleTheme } = useTheme();
	const [state, setState] = useState<AppState>(readState);
	const [view, setView] = useState<View>("today");
	const [pianoMode, setPianoMode] = useState(false);
	const pollTapCount = useRef(0);
	const pollTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	function handlePollTabClick() {
		setView("today");
		if (pollTapTimer.current) clearTimeout(pollTapTimer.current);
		pollTapCount.current += 1;
		if (pollTapCount.current >= 3) {
			pollTapCount.current = 0;
			setPianoMode((m) => !m);
			return;
		}
		pollTapTimer.current = setTimeout(() => {
			pollTapCount.current = 0;
		}, 2500);
	}
	const [historyDate, setHistoryDate] = useState(todayKey);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [openPoll, setOpenPoll] = useState<OpenPoll>(null);
	const [eggOpen, setEggOpen] = useState(false);
	const [, setEggTaps] = useState(0);
	function tapLogo() {
		setEggTaps((n) => {
			const next = n + 1;
			if (next >= 5) {
				setEggOpen(true);
				return 0;
			}
			return next;
		});
	}
	const [, setNameTaps] = useState(0);
	const nameTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	function tapName() {
		setNameTaps((n) => {
			const next = n + 1;
			if (nameTapTimer.current) clearTimeout(nameTapTimer.current);
			if (next >= 5) {
				launchConfetti();
				return 0;
			}
			nameTapTimer.current = setTimeout(() => setNameTaps(0), 1500);
			return next;
		});
	}
	function launchConfetti() {
		const canvas = document.createElement("canvas");
		canvas.style.cssText =
			"position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		document.body.appendChild(canvas);
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			canvas.remove();
			return;
		}
		const drawingContext = ctx;
		const colors = [
			"#a06840",
			"#d09060",
			"#5a3c26",
			"#c8956a",
			"#f0e6d8",
			"#68452e",
			"#b87848",
		];
		const pieces = Array.from({ length: 120 }, () => ({
			x: Math.random() * canvas.width,
			y: -10 - Math.random() * 100,
			vx: (Math.random() - 0.5) * 6,
			vy: 3 + Math.random() * 4,
			rot: Math.random() * Math.PI * 2,
			rotV: (Math.random() - 0.5) * 0.3,
			w: 8 + Math.random() * 8,
			h: 4 + Math.random() * 4,
			color: colors[Math.floor(Math.random() * colors.length)],
			alpha: 1,
		}));
		let raf = 0;
		function draw() {
			drawingContext.clearRect(0, 0, canvas.width, canvas.height);
			let alive = false;
			for (const p of pieces) {
				p.x += p.vx;
				p.y += p.vy;
				p.vy += 0.12;
				p.rot += p.rotV;
				if (p.y > canvas.height + 20) continue;
				if (p.y > canvas.height * 0.7) p.alpha = Math.max(0, p.alpha - 0.03);
				alive = true;
				drawingContext.save();
				drawingContext.globalAlpha = p.alpha;
				drawingContext.translate(p.x, p.y);
				drawingContext.rotate(p.rot);
				drawingContext.fillStyle = p.color;
				drawingContext.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
				drawingContext.restore();
			}
			if (alive) {
				raf = requestAnimationFrame(draw);
			} else {
				cancelAnimationFrame(raf);
				canvas.remove();
			}
		}
		raf = requestAnimationFrame(draw);
	}
	const [error, setError] = useState<string | null>(null);
	const [profileReady, setProfileReady] = useState(false);
	const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
	const [localUser, setLocalUser] = useState<User | null>(null);
	const [localComplete, setLocalComplete] = useState(false);
	const [guestSession, setGuestSession] = useState<GuestSession | null>(null);
	const [guestPending, setGuestPending] = useState(true);
	const [guestSetup, setGuestSetup] = useState(false);
	const [accessDenied, setAccessDenied] = useState(false);
	const [adminData, setAdminData] = useState<AdminDashboard | null>(null);
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
	const visibleView: View = isGuest ? "today" : view;
	const signInError = authErrorMessage();
	useEffect(() => {
		if (isGuest && view !== "today") setView("today");
	}, [isGuest, view]);
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
		// Replace history so OAuth redirect URL is removed — prevents back-button returning to login
		if (window.location.search || window.location.pathname !== "/") {
			window.history.replaceState(null, "", "/");
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
						user: {
							...user,
							role: profile.role,
							isOnLeave: profile.isOnLeave,
							availability: profile.availability,
						},
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
							user: {
								...user,
								role: profile.role,
								isOnLeave: profile.isOnLeave,
								availability:
									day.responses.find((entry) => entry.user.email === user.email)
										?.availability ?? profile.availability,
							},
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
						entries: { ...current.entries, [todayKey]: day.responses },
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
	}, [guestSession, profileReady, sessionUserId, view]);
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
		if (!sessionUserId && !guestSession) return;
		let cancelled = false;
		setHistoryLoading(true);
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
			})
			.finally(() => {
				if (!cancelled) setHistoryLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [guestSession, historyDate, sessionUserId]);
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
		authClient.signIn
			.social({ provider: "google", callbackURL: "/" })
			.catch((reason: unknown) => {
				setError(
					reason instanceof Error
						? reason.message
						: "Sign-in failed. Check your network and try again.",
				);
			});
	}
	function signOut() {
		if (guestSession) void leaveGuest();
		else void authClient.signOut();
		setGuestSession(null);
		setGuestSetup(false);
		setAccessDenied(false);
		setAdminData(null);
		setLocalUser(null);
		setLocalComplete(false);
		setState((current) => ({ ...current, user: null }));
	}
	function signUpLocally() {
		setLocalComplete(false);
		setLocalUser({
			id: "local-test-user",
			name: "Local test user",
			email: "local@brewbook.test",
		});
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
			setOnboarding(null);
			setLocalComplete(true);
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
	function updateEntry(period: Period, drink: Drink) {
		if (!state.user) return;
		const existing = state.entries[todayKey]?.find(
			(entry) => entry.user.email === state.user?.email,
		);
		const choices = {
			...(existing?.choices ?? state.defaults),
			[period]: drink,
		};
		const sugar = existing?.sugar?.[period] ?? state.sugarDefaults[period];
		setState((current) => {
			if (!current.user) return current;
			const nextEntries = (current.entries[todayKey] ?? []).map((entry) =>
				entry.user.email === current.user?.email
					? {
							...entry,
							choices,
							sugar: { ...entry.sugar, [period]: sugar },
							sources: { ...entry.sources, [period]: "manual" as const },
						}
					: entry,
			);
			return {
				...current,
				entries: { ...current.entries, [todayKey]: nextEntries },
			};
		});
		void saveResponse({ date: todayKey, period, drink, sugar })
			.then((day) => {
				setState((current) => ({
					...current,
					defaults: day.defaults,
					sugarDefaults: day.sugarDefaults,
					entries: { ...current.entries, [todayKey]: day.responses },
				}));
				setError(null);
			})
			.catch((reason: unknown) =>
				setError(reportSentryError(reason, "Unable to save your drink")),
			);
	}

	function updateDefault(period: Period, drink: Drink, sugar: boolean) {
		setState((current) => ({
			...current,
			defaults: { ...current.defaults, [period]: drink },
			sugarDefaults: { ...current.sugarDefaults, [period]: sugar },
		}));
		void saveDefault({ period, drink, sugar })
			.then((settings) => {
				setState((current) => ({
					...current,
					defaults: settings.defaults,
					sugarDefaults: settings.sugarDefaults,
				}));
				setError(null);
			})
			.catch((reason: unknown) =>
				setError(reportSentryError(reason, "Unable to save your default")),
			);
	}
	function updateSugar(period: Period, sugar: boolean) {
		if (!state.user) return;
		const existing = state.entries[todayKey]?.find(
			(entry) => entry.user.email === state.user?.email,
		);
		const drink = existing?.choices[period] ?? state.defaults[period];
		setState((current) => ({
			...current,
			entries: {
				...current.entries,
				[todayKey]: (current.entries[todayKey] ?? []).map((entry) =>
					entry.user.email === current.user?.email
						? {
								...entry,
								sugar: { ...entry.sugar, [period]: sugar },
								sources: { ...entry.sources, [period]: "manual" as const },
							}
						: entry,
				),
			},
		}));
		void saveResponse({ date: todayKey, period, drink, sugar })
			.then((day) => {
				setState((current) => ({
					...current,
					defaults: day.defaults,
					sugarDefaults: day.sugarDefaults,
					entries: { ...current.entries, [todayKey]: day.responses },
				}));
				setError(null);
			})
			.catch((reason: unknown) =>
				setError(reportSentryError(reason, "Unable to save sugar preference")),
			);
	}

	const [availabilityLoading, setAvailabilityLoading] = useState<Period | null>(
		null,
	);
	function updateAvailability(period: Period, status: AttendanceStatus) {
		if (!state.user || availabilityLoading) return;
		const nextAvailability = {
			morning: state.user.availability?.morning ?? "office",
			evening: state.user.availability?.evening ?? "office",
			[period]: status,
		};
		setState((current) => ({
			...current,
			user: current.user
				? { ...current.user, availability: nextAvailability }
				: null,
		}));
		setAvailabilityLoading(period);
		void setAvailability({ date: todayKey, period, status })
			.then(() => getDrinkDay(todayKey))
			.then((day) =>
				setState((current) => ({
					...current,
					user: current.user
						? {
								...current.user,
								availability:
									day.responses.find(
										(entry) => entry.user.email === current.user?.email,
									)?.availability ?? nextAvailability,
							}
						: null,
					entries: { ...current.entries, [todayKey]: day.responses },
				})),
			)
			.catch((reason: unknown) =>
				setError(reportSentryError(reason, "Unable to save availability")),
			)
			.finally(() => setAvailabilityLoading(null));
	}

	if (authPending || guestPending)
		return <AuthLoading message={pickRandom(brewingMessages)} />;
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
	if (localComplete) return <LocalSetupComplete onReset={signOut} />;
	if (!state.user) return <AuthLoading message={pickRandom(brewingMessages)} />;
	if (!profileReady)
		return <AuthLoading message={pickRandom(brewingMessages)} />;
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
	const historyPolls = state.entries[historyDate] ?? [];
	const openPollData = openPoll ? (state.entries[openPoll.date] ?? []) : [];
	return (
		<ErrorBoundary fallback={AppErrorFallback}>
			<main
				className={cx(
					"min-h-dvh bg-[var(--c-page)] text-[var(--c-text)] lg:pb-0",
				)}
				style={{
					paddingTop: "calc(57px + env(safe-area-inset-top))",
					paddingBottom: isGuest
						? undefined
						: "calc(5rem + env(safe-area-inset-bottom))",
				}}
			>
				<header
					className="fixed inset-x-0 top-0 z-10 border-b border-[var(--c-border)] bg-[var(--c-card)]/95 backdrop-blur"
					style={{ paddingTop: "env(safe-area-inset-top)" }}
				>
					<div className="mx-auto flex max-w-[1180px] items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
						<button
							type="button"
							onClick={tapLogo}
							className="flex items-center gap-2.5"
							aria-label="BrewBook logo"
						>
							<BrandMark />
							<span className="font-serif text-xl font-semibold tracking-[-0.02em]">
								BrewBook
							</span>
						</button>
						<button
							onClick={tapName}
							type="button"
							aria-label="Open profile"
							className="text-sm font-semibold text-[var(--c-text-mid)] transition hover:text-[var(--c-brand)]"
						>
							Hi, {state.user.name.split(" ")[0]}
						</button>
					</div>
				</header>
				{error && (
					<div className="mx-auto mt-4 max-w-[1180px] px-4 sm:px-6 lg:px-8">
						<div
							className="rounded-xl border border-[var(--c-border-err)] bg-[var(--c-err-bg)] px-3 py-2 text-sm text-[var(--c-text-err)]"
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
								onPollClick={handlePollTabClick}
								pianoOn={pianoMode}
							/>
						</aside>
					)}
					<section className="min-w-0">
						{visibleView === "today" && (
							<TodayView
								guest={isGuest}
								entry={todaysEntry}
								sugar={todaysSugar}
								todayPolls={todayPolls}
								updateEntry={updateEntry}
								updateSugar={updateSugar}
								onOpen={(period) => setOpenPoll({ date: todayKey, period })}
								availability={state.user.availability}
								onUpdateAvailability={updateAvailability}
								availabilityLoading={availabilityLoading}
								pianoMode={pianoMode}
							/>
						)}
						{visibleView === "stats" && !isGuest && <StatsView />}
						{visibleView === "profile" && !isGuest && (
							<ProfileView
								user={state.user}
								defaults={state.defaults}
								sugarDefaults={state.sugarDefaults}
								updateDefault={updateDefault}
								onSignOut={signOut}
								isGuest={isGuest}
								dark={dark}
								onToggleTheme={toggleTheme}
								historyDate={historyDate}
								setHistoryDate={setHistoryDate}
								historyPolls={historyPolls}
								historyLoading={historyLoading}
							/>
						)}
						{visibleView === "admin" && !isGuest && (
							<AdminView
								data={adminData}
								onRefresh={() => void getAdminDashboard().then(setAdminData)}
							/>
						)}
					</section>
				</div>
				{!isGuest && (
					<div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--c-border)] bg-[var(--c-card)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:px-4 lg:hidden">
						<Nav
							admin={state.user.role === "admin"}
							view={view}
							setView={setView}
							onPollClick={handlePollTabClick}
							pianoOn={pianoMode}
							mobile
						/>
					</div>
				)}
				{eggOpen && <GlassEasterEgg onClose={() => setEggOpen(false)} />}
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
