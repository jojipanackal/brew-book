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
import { AppMenu } from "./components/navigation";
import { PollDetailsSheet } from "./components/overlays";
import { ProfileView } from "./components/profile";
import { StatsView } from "./components/stats";
import { TodayView } from "./components/today";
import { brewingMessages, initialState, todayKey } from "./constants";
import { useTheme } from "./hooks/use-theme";
import type { AppState, OnboardingState, OpenPoll, View } from "./types";
import {
	authErrorMessage,
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
	const [historyDate, setHistoryDate] = useState(todayKey);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [openPoll, setOpenPoll] = useState<OpenPoll>(null);
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
			if (mutation.current.pending) return;
			const revision = mutation.current.revision;
			void getDrinkDay(todayKey)
				.then((day) => {
					if (
						cancelled ||
						mutation.current.pending ||
						revision !== mutation.current.revision
					)
						return;
					setState((current) => ({
						...current,
						defaults: day.defaults,
						sugarDefaults: day.sugarDefaults,
						entries: { ...current.entries, [todayKey]: day.responses },
					}));
					setError(null);
				})
				.catch((reason: unknown) => {
					if (
						!cancelled &&
						!mutation.current.pending &&
						revision === mutation.current.revision
					)
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
		const revision = mutation.current.revision;
		void getDrinkDay(historyDate)
			.then((day) => {
				if (
					cancelled ||
					mutation.current.pending ||
					revision !== mutation.current.revision
				)
					return;
				setState((current) => ({
					...current,
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
	const [saving, setSaving] = useState(false);
	const [saveMessage, setSaveMessage] = useState("");
	const mutation = useRef({ pending: false, revision: 0 });
	async function updateChoice(period: Period, drink: Drink, sugar: boolean) {
		if (!state.user || mutation.current.pending) return;
		mutation.current.pending = true;
		mutation.current.revision += 1;
		setSaving(true);
		setSaveMessage("");
		try {
			const day = await saveResponse({ date: todayKey, period, drink, sugar });
			setState((current) => ({
				...current,
				defaults: day.defaults,
				sugarDefaults: day.sugarDefaults,
				entries: { ...current.entries, [todayKey]: day.responses },
			}));
			setError(null);
			setSaveMessage(
				`${period === "morning" ? "Morning" : "Evening"} choice saved.`,
			);
		} catch (reason: unknown) {
			setError(reportSentryError(reason, "Unable to save your drink"));
			setSaveMessage(
				"Not saved. Please try again; your previous choice is unchanged.",
			);
		} finally {
			mutation.current.pending = false;
			setSaving(false);
		}
	}
	function updateEntry(period: Period, drink: Drink) {
		void updateChoice(period, drink, todaysSugar[period]);
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
		void updateChoice(period, todaysEntry[period], sugar);
	}

	const [availabilityLoading, setAvailabilityLoading] = useState<Period | null>(
		null,
	);
	function updateAvailability(period: Period, status: AttendanceStatus) {
		if (!state.user || mutation.current.pending) return;
		mutation.current.pending = true;
		mutation.current.revision += 1;
		setSaveMessage("");
		const nextAvailability = {
			morning: state.user.availability?.morning ?? "office",
			evening: state.user.availability?.evening ?? "office",
			[period]: status,
		};
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
			.catch((reason: unknown) => {
				setError(reportSentryError(reason, "Unable to save availability"));
				setSaveMessage("Unable to refresh attendance. Please try again.");
			})
			.finally(() => {
				mutation.current.pending = false;
				setAvailabilityLoading(null);
			});
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
			<div className="app-shell">
				<a className="skip-link" href="#main-content">
					Skip to content
				</a>
				<header className="app-header">
					<button
						type="button"
						className="wordmark"
						onClick={() => setView("today")}
						aria-label="BrewBook, today"
					>
						brew<span>book</span>
						<span className="brand-dot" aria-hidden="true">
							.
						</span>
					</button>
					<AppMenu
						view={visibleView}
						setView={setView}
						admin={state.user.role === "admin"}
						guest={isGuest}
						name={state.user.name}
						onSignOut={signOut}
					/>
				</header>
				{error && (
					<div className="app-error" role="alert">
						{error}
					</div>
				)}
				<main
					id="main-content"
					tabIndex={-1}
					className={
						visibleView === "admin"
							? "app-content app-content-wide"
							: "app-content"
					}
				>
					{visibleView === "today" && (
						<TodayView
							guest={isGuest}
							entry={todaysEntry}
							sugar={todaysSugar}
							todayPolls={todayPolls}
							updateEntry={updateEntry}
							updateSugar={updateSugar}
							onOpen={(period) => setOpenPoll({ date: todayKey, period })}
							availability={todayPoll?.availability ?? state.user.availability}
							onUpdateAvailability={updateAvailability}
							availabilityLoading={availabilityLoading}
							saving={saving}
							saveMessage={saveMessage}
							sources={todayPoll?.sources}
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
				</main>
				<footer className="app-footer">
					<span>A little pause in your day.</span>
					<a
						href="https://github.com/jojipanackal/brew-book"
						target="_blank"
						rel="noreferrer"
					>
						BrewBook on GitHub ↗
					</a>
				</footer>
				{openPoll && (
					<PollDetailsSheet
						date={openPoll.date}
						period={openPoll.period}
						polls={openPollData}
						onClose={() => setOpenPoll(null)}
					/>
				)}
			</div>
		</ErrorBoundary>
	);
}
