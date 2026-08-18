import { ErrorBoundary } from "@sentry/react";
import {
	ArrowLeft,
	ArrowRight,
	BarChart2,
	CalendarOff,
	CalendarDays,
	Check,
	ChevronDown,
	ChevronRight,
	Coffee,
	Eye,
	Info,
	Loader2,
	LogOut,
	Moon,
	ShieldCheck,
	Sun,
	User as UserIcon,
	X as XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FlipFluid, FluidRenderer, setupFluidScene } from "#/lib/fluid";

import { authClient } from "#/lib/auth-client";
import {
	type AdminDashboard,
	type AttendanceStatus,
	calculatePollResults,
	type Company,
	type CompanyRecord,
	completeOnboarding,
	createCook,
	createGuest,
	deleteCook,
	type Drink,
	type DrinkChoice,
	drinks,
	formatPollResultsMessage,
	generateWhatsAppUrl,
	type GuestSession,
	getAdminDashboard,
	getCompanies,
	getCooks,
	getDrinkDay,
	getGuestSession,
	getProfile,
	getStats,
	setAvailability,
	leaveGuest,
	type Period,
	type PollRecord,
	type PollResults,
	type PollSource,
	periods,
	type SugarChoice,
	saveDefault,
	saveResponse,
	type User,
	updateCook,
	updateGuestRequest,
	updateUserAvailability,
	updateUserResponse,
	type Cook,
} from "#/lib/drinks";
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
type View = "today" | "stats" | "profile" | "admin";
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
type DrinkInfo = {
	tagline: string;
	nutrition: Array<{ label: string; value: string }>;
	pros: string[];
	cons: string[];
};
const drinkInfo: Partial<Record<Drink, DrinkInfo>> = {
	Tea: {
		tagline: "Classic comfort in every sip",
		nutrition: [
			{ label: "Calories", value: "2 kcal" },
			{ label: "Caffeine", value: "20–50 mg" },
			{ label: "Antioxidants", value: "High" },
			{ label: "Sugar (plain)", value: "0 g" },
		],
		pros: ["Rich in antioxidants", "Mild caffeine boost", "Supports hydration", "May improve focus"],
		cons: ["Tannins can reduce iron absorption", "Can stain teeth", "May cause jitteriness in excess"],
	},
	Coffee: {
		tagline: "Your daily fuel",
		nutrition: [
			{ label: "Calories", value: "5 kcal" },
			{ label: "Caffeine", value: "80–100 mg" },
			{ label: "Antioxidants", value: "Very High" },
			{ label: "Sugar (plain)", value: "0 g" },
		],
		pros: ["Strong alertness boost", "Rich in antioxidants", "May improve metabolism", "Linked to reduced diabetes risk"],
		cons: ["Can cause anxiety or jitters", "May disrupt sleep", "Acidic, can irritate stomach", "Habit-forming"],
	},
	"Green tea": {
		tagline: "Calm energy, ancient wisdom",
		nutrition: [
			{ label: "Calories", value: "0 kcal" },
			{ label: "Caffeine", value: "15–30 mg" },
			{ label: "L-theanine", value: "High" },
			{ label: "Antioxidants", value: "Very High" },
		],
		pros: ["L-theanine promotes calm focus", "Powerful antioxidant EGCG", "Supports metabolism", "Gentle on stomach"],
		cons: ["Lower caffeine than coffee", "Can taste bitter if over-steeped", "May interfere with iron absorption"],
	},
	Milk: {
		tagline: "Strong bones, warm soul",
		nutrition: [
			{ label: "Calories", value: "61 kcal" },
			{ label: "Protein", value: "3.2 g" },
			{ label: "Calcium", value: "113 mg" },
			{ label: "Fat", value: "3.3 g" },
		],
		pros: ["Excellent source of calcium", "Complete protein", "Supports bone health", "Filling and nourishing"],
		cons: ["Higher calorie than other drinks", "Lactose intolerant? Skip it", "Full-fat adds saturated fat"],
	},
	"Black Coffee": {
		tagline: "Pure. Bold. Unapologetic.",
		nutrition: [
			{ label: "Calories", value: "2 kcal" },
			{ label: "Caffeine", value: "80–100 mg" },
			{ label: "Fat", value: "0 g" },
			{ label: "Sugar", value: "0 g" },
		],
		pros: ["Zero calories", "Maximum caffeine hit", "Sharpens mental clarity", "Rich in antioxidants"],
		cons: ["Very acidic", "Can cause heartburn", "May raise blood pressure", "Bitter taste not for everyone"],
	},
	"Black Tea": {
		tagline: "Bold, robust, timeless",
		nutrition: [
			{ label: "Calories", value: "2 kcal" },
			{ label: "Caffeine", value: "40–70 mg" },
			{ label: "Antioxidants", value: "High" },
			{ label: "Sugar (plain)", value: "0 g" },
		],
		pros: ["Higher caffeine than green tea", "Good gut health support", "Heart-healthy antioxidants", "Rich robust flavour"],
		cons: ["Tannins reduce iron absorption", "Can stain teeth", "May cause acid reflux"],
	},
	"No drink": {
		tagline: "Staying hydrated is a choice too",
		nutrition: [
			{ label: "Calories", value: "0 kcal" },
			{ label: "Caffeine", value: "0 mg" },
			{ label: "Sugar", value: "0 g" },
			{ label: "Hydration", value: "Water instead?" },
		],
		pros: ["No caffeine dependency", "Zero calories", "Easy on the stomach"],
		cons: ["Might miss out on antioxidants", "No caffeine boost for focus"],
	},
};

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Asia/Kolkata",
});
const displayDateFormatter = new Intl.DateTimeFormat("en-US", {
	weekday: "short",
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "Asia/Kolkata",
});
const todayKey = dateFormatter.format(new Date());
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

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
	void navigator.serviceWorker.register('/sw.js')
}

function useTheme() {
	const [dark, setDark] = useState(() => {
		if (typeof window === "undefined") return false;
		const saved = localStorage.getItem("theme");
		if (saved) return saved === "dark";
		return window.matchMedia("(prefers-color-scheme: dark)").matches;
	});
	useEffect(() => {
		document.documentElement.classList.toggle("dark", dark);
		localStorage.setItem("theme", dark ? "dark" : "light");
	}, [dark]);
	return { dark, toggle: () => setDark((d) => !d) };
}



function useGyroscope() {
	const [tilt, setTilt] = useState({ gamma: 0, beta: 0 });
	const [permission, setPermission] = useState<"unknown" | "granted" | "denied">("unknown");

	useEffect(() => {
		// Check if permission API exists (iOS 13+)
		const needsPermission = typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === "function";
		if (!needsPermission) {
			setPermission("granted");
		}
	}, []);

	useEffect(() => {
		if (permission !== "granted") return;
		function handler(e: DeviceOrientationEvent) {
			setTilt({
				gamma: Math.max(-45, Math.min(45, e.gamma ?? 0)),
				beta: Math.max(-90, Math.min(90, e.beta ?? 0)),
			});
		}
		window.addEventListener("deviceorientation", handler, true);
		return () => window.removeEventListener("deviceorientation", handler, true);
	}, [permission]);

	async function requestPermission() {
		const api = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
		if (api) {
			const result = await api();
			setPermission(result === "granted" ? "granted" : "denied");
		} else {
			setPermission("granted");
		}
	}

	return { tilt, permission, requestPermission };
}


function displayDate(dateKey: string) {
	return displayDateFormatter.format(new Date(`${dateKey}T12:00:00`));
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
function availabilityLabel(status: AttendanceStatus) {
	return status === "wfh" ? "WFH" : status === "leave" ? "Leave" : "In office";
}
function MetaTag({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
	return (
		<span
			className={cx(
				"inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4",
				muted
					? "border-[var(--c-border)] bg-[var(--c-card)] text-[var(--c-text-muted)]"
					: "border-[var(--c-border-3)] bg-[var(--c-accent-bg)] text-[var(--c-text-mid)]",
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
function countChoices(entries: DrinkChoice[]) {
	return periods.reduce(
		(result, period) => {
			result[period] = drinks.reduce<Record<string, number>>(
				(counts, drink) => {
					counts[drink] = entries.filter(
						(entry) => entry[period] === drink,
					).length;
					return counts;
				},
				{},
			);
			return result;
		},
		{} as Record<Period, Record<string, number>>,
	);
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
		pollTapTimer.current = setTimeout(() => { pollTapCount.current = 0; }, 2500);
	}
	const [historyDate, setHistoryDate] = useState(todayKey);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [openPoll, setOpenPoll] = useState<OpenPoll>(null);
	const [eggOpen, setEggOpen] = useState(false);
	const [, setEggTaps] = useState(0);
	function tapLogo() {
		setEggTaps((n) => {
			const next = n + 1;
			if (next >= 5) { setEggOpen(true); return 0; }
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
		canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		document.body.appendChild(canvas);
		const ctx = canvas.getContext("2d")!;
		const colors = ["#a06840","#d09060","#5a3c26","#c8956a","#f0e6d8","#68452e","#b87848"];
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
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			let alive = false;
			for (const p of pieces) {
				p.x += p.vx; p.y += p.vy; p.vy += 0.12;
				p.rot += p.rotV;
				if (p.y > canvas.height + 20) continue;
				if (p.y > canvas.height * 0.7) p.alpha = Math.max(0, p.alpha - 0.03);
				alive = true;
				ctx.save();
				ctx.globalAlpha = p.alpha;
				ctx.translate(p.x, p.y);
				ctx.rotate(p.rot);
				ctx.fillStyle = p.color;
				ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
				ctx.restore();
			}
			if (alive) { raf = requestAnimationFrame(draw); }
			else { cancelAnimationFrame(raf); canvas.remove(); }
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
						user: { ...user, role: profile.role, isOnLeave: profile.isOnLeave, availability: profile.availability },
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
							user: { ...user, role: profile.role, isOnLeave: profile.isOnLeave, availability: day.responses.find((entry) => entry.user.email === user.email)?.availability ?? profile.availability },
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
		authClient.signIn.social({ provider: "google", callbackURL: "/" }).catch((reason: unknown) => {
			setError(reason instanceof Error ? reason.message : "Sign-in failed. Check your network and try again.");
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

	const [availabilityLoading, setAvailabilityLoading] = useState<Period | null>(null);
	function updateAvailability(period: Period, status: AttendanceStatus) {
		if (!state.user || availabilityLoading) return;
		const nextAvailability = { morning: state.user.availability?.morning ?? 'office', evening: state.user.availability?.evening ?? 'office', [period]: status };
		setState((current) => ({ ...current, user: current.user ? { ...current.user, availability: nextAvailability } : null }));
		setAvailabilityLoading(period);
		void setAvailability({ date: todayKey, period, status })
			.then(() => getDrinkDay(todayKey))
			.then((day) => setState((current) => ({ ...current, user: current.user ? { ...current.user, availability: day.responses.find((entry) => entry.user.email === current.user?.email)?.availability ?? nextAvailability } : null, entries: { ...current.entries, [todayKey]: day.responses } })))
			.catch((reason: unknown) => setError(reportSentryError(reason, "Unable to save availability")))
			.finally(() => setAvailabilityLoading(null));
	}

	if (authPending || guestPending) return <AuthLoading message={pickRandom(brewingMessages)} />;
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
	if (!profileReady) return <AuthLoading message={pickRandom(brewingMessages)} />;
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
					paddingBottom: isGuest ? undefined : "calc(5rem + env(safe-area-inset-bottom))",
				}}
			>
				<header className="fixed inset-x-0 top-0 z-10 border-b border-[var(--c-border)] bg-[var(--c-card)]/95 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
					<div className="mx-auto flex max-w-[1180px] items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
					<button type="button" onClick={tapLogo} className="flex items-center gap-2.5" aria-label="BrewBook logo">
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
						{visibleView === "stats" && !isGuest && (
							<StatsView />
						)}
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

function AdminResultsView({
	data,
	cooks,
	onSendToCook,
}: {
	data: AdminDashboard;
	cooks: Cook[];
	onSendToCook: (period: Period, results: PollResults) => void;
}) {
	return (
		<div className="grid gap-4">
			{periods.map((period) => {
				const results = calculatePollResults(data.responses, period);
				const hasDrinks = Object.values(results.results).some((count) => count > 0);

				return (
					<section key={period} className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] p-4">
						<div className="flex items-center justify-between gap-3">
							<div>
								<h2 className="text-sm font-semibold text-[var(--c-text-dark)]">
									{period === "morning" ? "Morning" : "Evening"} Results
								</h2>
								<p className="mt-1 text-xs text-[var(--c-text-muted)]">
									{results.total === 0 ? "No responses yet" : `Total: ${results.total}`}
								</p>
							</div>
							{hasDrinks && cooks.length > 0 && (
								<button
									onClick={() => onSendToCook(period, results)}
									type="button"
									className="shrink-0 rounded-lg bg-[var(--c-brand)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
								>
									Send to Cook
								</button>
							)}
						</div>

						{hasDrinks ? (
							<div className="mt-3 space-y-2">
								{Object.entries(results.results)
									.filter(([drink]) => drink !== "No drink")
									.map(([drink, count]) => (
										count > 0 && (
											<div key={drink} className="flex items-center justify-between rounded-lg bg-[var(--c-row)] px-3 py-2">
												<span className="text-sm text-[var(--c-text-mid)]">{drink}</span>
												<span className="font-semibold text-[var(--c-brand)]">{count}</span>
											</div>
										)
									))}
							</div>
						) : (
							<p className="mt-3 text-xs text-[var(--c-text-muted)]">
								No responses have been recorded for this poll.
							</p>
						)}
					</section>
				);
			})}
		</div>
	);
}

function AdminCooksView({
	cooks,
	loading,
	editingCook,
	showAddCook,
	onRefresh,
	onEdit,
	onShowAdd,
	onCloseAdd,
	onCloseEdit,
}: {
	cooks: Cook[];
	loading: boolean;
	editingCook: Cook | null;
	showAddCook: boolean;
	onRefresh: () => void;
	onEdit: (cook: Cook) => void;
	onShowAdd: () => void;
	onCloseAdd: () => void;
	onCloseEdit: () => void;
}) {
	return (
		<div className="grid gap-4">
			<section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] p-4">
				<div className="flex items-center justify-between gap-3">
					<h2 className="text-sm font-semibold text-[var(--c-text-dark)]">Cooks</h2>
					<button
						onClick={onShowAdd}
						type="button"
						className="rounded-lg bg-[var(--c-brand)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
					>
						+ Add Cook
					</button>
				</div>

				{loading ? (
					<div className="mt-4 text-center text-xs text-[var(--c-text-muted)]">
						Loading cooks...
					</div>
				) : cooks.length === 0 ? (
					<div className="mt-4 text-center text-xs text-[var(--c-text-muted)]">
						No cooks added yet
					</div>
				) : (
					<div className="mt-3 space-y-2">
						{cooks.map((cook) => (
							<div
								key={cook.id}
								className={cx(
									"rounded-lg px-3 py-3",
									cook.isActive
										? "bg-[var(--c-row)]"
										: "bg-[var(--c-muted)] opacity-60",
								)}
							>
								<div className="flex items-center justify-between gap-3">
									<div className="min-w-0">
										<p className="truncate text-sm font-semibold">{cook.name}</p>
										<p className="mt-1 truncate text-xs text-[var(--c-text-muted)]">
											+{cook.phoneNumber}
										</p>
									</div>
									<div className="flex shrink-0 gap-2">
										<button
											onClick={() => onEdit(cook)}
											type="button"
											className="rounded-lg border border-[var(--c-border)] px-3 py-2 text-xs font-semibold text-[var(--c-text-mid)] hover:bg-[var(--c-card)]"
										>
											Edit
										</button>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</section>

			{showAddCook && (
				<AddCookModal onClose={onCloseAdd} onRefresh={onRefresh} />
			)}

			{editingCook && (
				<EditCookModal cook={editingCook} onClose={onCloseEdit} onRefresh={onRefresh} />
			)}
		</div>
	);
}

function AddCookModal({
	onClose,
	onRefresh,
}: {
	onClose: () => void;
	onRefresh: () => void;
}) {
	const [name, setName] = useState("");
	const [phone, setPhone] = useState("");
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	const handleSubmit = () => {
		setError("");
		if (!name.trim()) {
			setError("Name is required");
			return;
		}
		if (!phone.trim()) {
			setError("Phone number is required");
			return;
		}

		setSaving(true);
		void createCook({ name: name.trim(), phoneNumber: phone.trim() })
			.then(() => {
				onRefresh();
				onClose();
			})
			.catch((err) => {
				setError(err instanceof Error ? err.message : "Failed to create cook");
				setSaving(false);
			});
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="w-full max-w-md rounded-2xl bg-[var(--c-card)] p-6">
				<h2 className="text-lg font-semibold text-[var(--c-text-dark)]">Add Cook</h2>

				<div className="mt-4 space-y-3">
					<div>
						<label className="block text-xs font-semibold text-[var(--c-text-mid)]">
							Name
						</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Cook name"
							className="mt-1 h-10 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 text-sm text-[var(--c-text-dark)]"
						/>
					</div>

					<div>
						<label className="block text-xs font-semibold text-[var(--c-text-mid)]">
							Phone Number
						</label>
						<input
							type="text"
							value={phone}
							onChange={(e) => setPhone(e.target.value)}
							placeholder="+91 98765 43210"
							className="mt-1 h-10 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 text-sm text-[var(--c-text-dark)]"
						/>
						<p className="mt-1 text-xs text-[var(--c-text-muted)]">
							Include country code (e.g., +91 for India)
						</p>
					</div>

					{error && (
						<div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
							{error}
						</div>
					)}
				</div>

				<div className="mt-6 flex gap-3">
					<button
						onClick={onClose}
						type="button"
						disabled={saving}
						className="flex-1 rounded-lg border border-[var(--c-border)] px-3 py-2 text-sm font-semibold text-[var(--c-text-mid)] hover:bg-[var(--c-muted)]"
					>
						Cancel
					</button>
					<button
						onClick={handleSubmit}
						type="button"
						disabled={saving}
						className="flex-1 rounded-lg bg-[var(--c-brand)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
					>
						{saving ? "Saving..." : "Add"}
					</button>
				</div>
			</div>
		</div>
	);
}

function EditCookModal({
	cook,
	onClose,
	onRefresh,
}: {
	cook: Cook;
	onClose: () => void;
	onRefresh: () => void;
}) {
	const [name, setName] = useState(cook.name);
	const [phone, setPhone] = useState(cook.phoneNumber);
	const [isActive, setIsActive] = useState(cook.isActive);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	const handleDelete = () => {
		if (!window.confirm(`Remove ${cook.name}? This cannot be undone.`)) return;

		setError("");
		setSaving(true);
		void deleteCook(cook.id)
			.then(() => {
				onRefresh();
				onClose();
			})
			.catch((err) => {
				setError(err instanceof Error ? err.message : "Failed to remove cook");
				setSaving(false);
			});
	};

	const handleSubmit = () => {
		setError("");
		if (!name.trim()) {
			setError("Name is required");
			return;
		}
		if (!phone.trim()) {
			setError("Phone number is required");
			return;
		}

		const updates: {
			id: string;
			name?: string;
			phoneNumber?: string;
			isActive?: boolean;
		} = { id: cook.id };

		if (name !== cook.name) updates.name = name.trim();
		if (phone !== cook.phoneNumber) updates.phoneNumber = phone.trim();
		if (isActive !== cook.isActive) updates.isActive = isActive;

		setSaving(true);
		void updateCook(updates)
			.then(() => {
				onRefresh();
				onClose();
			})
			.catch((err) => {
				setError(err instanceof Error ? err.message : "Failed to update cook");
				setSaving(false);
			});
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="w-full max-w-md rounded-2xl bg-[var(--c-card)] p-6">
				<h2 className="text-lg font-semibold text-[var(--c-text-dark)]">Edit Cook</h2>

				<div className="mt-4 space-y-3">
					<div>
						<label className="block text-xs font-semibold text-[var(--c-text-mid)]">
							Name
						</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="mt-1 h-10 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 text-sm text-[var(--c-text-dark)]"
						/>
					</div>

					<div>
						<label className="block text-xs font-semibold text-[var(--c-text-mid)]">
							Phone Number
						</label>
						<input
							type="text"
							value={phone}
							onChange={(e) => setPhone(e.target.value)}
							className="mt-1 h-10 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 text-sm text-[var(--c-text-dark)]"
						/>
					</div>

					<div className="flex items-center gap-3 rounded-lg bg-[var(--c-row)] p-3">
						<label className="flex flex-1 cursor-pointer items-center gap-3">
							<input
								type="checkbox"
								checked={isActive}
								onChange={(e) => setIsActive(e.target.checked)}
								className="h-4 w-4"
							/>
							<span className="text-sm font-semibold text-[var(--c-text-dark)]">
								Active
							</span>
						</label>
					</div>

					{error && (
						<div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
							{error}
						</div>
					)}
				</div>

				<div className="mt-6 flex gap-3">
					<button
						onClick={handleDelete}
						type="button"
						disabled={saving}
						className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
					>
						Remove
					</button>
					<button
						onClick={onClose}
						type="button"
						disabled={saving}
						className="flex-1 rounded-lg border border-[var(--c-border)] px-3 py-2 text-sm font-semibold text-[var(--c-text-mid)] hover:bg-[var(--c-muted)]"
					>
						Cancel
					</button>
					<button
						onClick={handleSubmit}
						type="button"
						disabled={saving}
						className="flex-1 rounded-lg bg-[var(--c-brand)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
					>
						{saving ? "Saving..." : "Save"}
					</button>
				</div>
			</div>
		</div>
	);
}

function SendToCookModal({
	results,
	period,
	selectedCook,
	cooks,
	onSelectCook,
	onClose,
}: {
	results: PollResults;
	period: Period;
	selectedCook: Cook | null;
	cooks: Cook[];
	onSelectCook: (cook: Cook) => void;
	onClose: () => void;
}) {
	const [step, setStep] = useState<"select" | "preview">(selectedCook ? "preview" : "select");

	const message = selectedCook ? formatPollResultsMessage(results, results.date) : "";
	const whatsappUrl = selectedCook ? generateWhatsAppUrl(selectedCook.phoneNumber, message) : "";

	if (step === "select") {
		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
				<div className="w-full max-w-md rounded-2xl bg-[var(--c-card)] p-6">
					<h2 className="text-lg font-semibold text-[var(--c-text-dark)]">Send Poll Result</h2>
					<p className="mt-1 text-sm text-[var(--c-text-muted)]">
						{period === "morning" ? "Morning" : "Evening"} Results
					</p>

					{cooks.length === 0 ? (
						<div className="mt-4 rounded-lg bg-amber-50 p-3">
							<p className="text-sm text-amber-900">
								No cooks have been added yet.
							</p>
							<p className="mt-2 text-xs text-amber-800">
								Add a cook from Admin → Cooks to send poll results.
							</p>
						</div>
					) : (
						<div className="mt-4 space-y-2">
							{cooks.map((cook) => (
								<button
									key={cook.id}
									onClick={() => {
										onSelectCook(cook);
										setStep("preview");
									}}
									type="button"
									className="w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-row)] px-3 py-3 text-left transition hover:bg-[var(--c-card)]"
								>
									<p className="font-semibold text-[var(--c-text-dark)]">{cook.name}</p>
									<p className="mt-1 text-xs text-[var(--c-text-muted)]">+{cook.phoneNumber}</p>
								</button>
							))}
						</div>
					)}

					<div className="mt-6 flex gap-3">
						<button
							onClick={onClose}
							type="button"
							className="flex-1 rounded-lg border border-[var(--c-border)] px-3 py-2 text-sm font-semibold text-[var(--c-text-mid)] hover:bg-[var(--c-muted)]"
						>
							Close
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="w-full max-w-md rounded-2xl bg-[var(--c-card)] p-6">
				<h2 className="text-lg font-semibold text-[var(--c-text-dark)]">Send to Cook</h2>

				<div className="mt-4 space-y-4">
					<div>
						<p className="text-xs font-semibold text-[var(--c-text-mid)]">Cook</p>
						<div className="mt-2 rounded-lg bg-[var(--c-row)] p-3">
							<p className="font-semibold text-[var(--c-text-dark)]">{selectedCook!.name}</p>
							<p className="mt-1 text-sm text-[var(--c-text-muted)]">+{selectedCook!.phoneNumber}</p>
						</div>
					</div>

					<div>
						<p className="text-xs font-semibold text-[var(--c-text-mid)]">Message</p>
						<div className="mt-2 whitespace-pre-wrap rounded-lg bg-[var(--c-row)] p-3 font-mono text-xs text-[var(--c-text-dark)]">
							{message}
						</div>
					</div>
				</div>

				<div className="mt-6 flex gap-3">
					<button
						onClick={() => setStep("select")}
						type="button"
						className="flex-1 rounded-lg border border-[var(--c-border)] px-3 py-2 text-sm font-semibold text-[var(--c-text-mid)] hover:bg-[var(--c-muted)]"
					>
						Back
					</button>
					<a
						href={whatsappUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="flex-1 rounded-lg bg-green-500 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-green-600 no-underline"
					>
						Open WhatsApp
					</a>
				</div>
			</div>
		</div>
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
	const [userSearch, setUserSearch] = useState("");
	const [adminTab, setAdminTab] = useState<"today" | "results" | "cooks">("today");
	const [cooks, setCooks] = useState<Cook[]>([]);
	const [loadingCooks, setLoadingCooks] = useState(false);
	const [editingCook, setEditingCook] = useState<Cook | null>(null);
	const [showAddCook, setShowAddCook] = useState(false);
	const [sendToCookData, setSendToCookData] = useState<{
		period: Period;
		selectedCook: Cook | null;
		results: PollResults | null;
	} | null>(null);
	const filteredUsers = data?.responses.filter((poll) => {
		const query = userSearch.trim().toLowerCase();
		return !query || `${poll.user.name} ${poll.user.email}`.toLowerCase().includes(query);
	}) ?? [];

	useEffect(() => {
		setLoadingCooks(true);
		void getCooks()
			.then((res) => setCooks(res.cooks))
			.catch(() => setCooks([]))
			.finally(() => setLoadingCooks(false));
	}, []);

	if (!data) return <AuthLoading message={pickRandom(brewingMessages)} />;
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

			{/* Admin Tabs */}
			<div className="flex gap-2 rounded-xl bg-[var(--c-card)] p-1">
				{[
					{ id: "today", label: "Users" },
					{ id: "results", label: "Results" },
					{ id: "cooks", label: "Cooks" },
				].map((tab) => (
					<button
						key={tab.id}
						onClick={() => setAdminTab(tab.id as typeof adminTab)}
						type="button"
						className={cx(
							"flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition",
							adminTab === tab.id
								? "bg-[var(--c-brand)] text-white"
								: "text-[var(--c-text-muted)] hover:text-[var(--c-text-mid)]",
						)}
					>
						{tab.label}
					</button>
				))}
			</div>

			{/* Guest Requests (always shown) */}
			{data.pendingGuests.length > 0 && (
				<section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] p-4">
					<h2 className="text-sm font-semibold text-[var(--c-text-dark)]">
						Guest requests
					</h2>
					<div className="mt-3 grid gap-2">
						{data.pendingGuests.map((guest) => (
							<div
								className="flex items-center justify-between gap-3 rounded-xl bg-[var(--c-row)] px-3 py-3"
								key={guest.id}
							>
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold">{guest.name}</p>
									<p className="text-xs text-[var(--c-text-muted)]">
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
										className="min-h-9 rounded-lg border border-[var(--c-border)] px-3 text-xs font-semibold text-[var(--c-text-mid)]"
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
										className="min-h-9 rounded-lg bg-[var(--c-brand)] px-3 text-xs font-semibold text-white"
									>
										Approve
									</button>
								</div>
							</div>
						))}
					</div>
				</section>
			)}

			{/* Users Tab */}
			{adminTab === "today" && (
				<section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] p-4">
					<h2 className="text-sm font-semibold text-[var(--c-text-dark)]">Users</h2>
					<input
						aria-label="Search users"
						className="mt-3 h-10 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 text-sm outline-none focus:border-[var(--c-brand-lt)]"
						onChange={(event) => setUserSearch(event.target.value)}
						placeholder="Search users by name or email"
						value={userSearch}
					/>
					<div className="mt-3 grid gap-3">
						{filteredUsers.map((poll) => {
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
						{filteredUsers.length === 0 && <p className="py-3 text-sm text-[var(--c-text-muted)]">No users found.</p>}
					</div>
				</section>
			)}

			{/* Results Tab */}
			{adminTab === "results" && (
				<AdminResultsView
					data={data}
					cooks={cooks}
					onSendToCook={(period, results) => {
						setSendToCookData({ period, selectedCook: null, results });
					}}
				/>
			)}

			{/* Cooks Tab */}
			{adminTab === "cooks" && (
				<AdminCooksView
					cooks={cooks}
					loading={loadingCooks}
					editingCook={editingCook}
					showAddCook={showAddCook}
					onRefresh={() => {
						setLoadingCooks(true);
						void getCooks()
							.then((res) => setCooks(res.cooks))
							.finally(() => setLoadingCooks(false));
					}}
					onEdit={(cook) => setEditingCook(cook)}
					onShowAdd={() => setShowAddCook(true)}
					onCloseAdd={() => setShowAddCook(false)}
					onCloseEdit={() => setEditingCook(null)}
				/>
			)}

			{/* Send to Cook Modal */}
			{sendToCookData && (
				<SendToCookModal
					results={sendToCookData.results}
					period={sendToCookData.period}
					selectedCook={sendToCookData.selectedCook}
					cooks={cooks.filter((c) => c.isActive)}
					onSelectCook={(cook) => setSendToCookData({ ...sendToCookData, selectedCook: cook })}
					onClose={() => setSendToCookData(null)}
				/>
			)}
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
	const updateAvailability = (period: Period, status: AttendanceStatus) => {
		if (!poll.user.id) return;
		void updateUserAvailability({ userId: poll.user.id, period, status }).then(onRefresh);
	};
	const removeGuest = () => {
		if (!poll.user.id) return;
		void updateGuestRequest({ type: "removeGuest", userId: poll.user.id }).then(
			onRefresh,
		);
	};
	return (
		<article className="rounded-xl bg-[var(--c-row)] p-3">
			<button
				onClick={onToggle}
				type="button"
				className="flex min-h-10 w-full items-center justify-between gap-3 text-left"
			>
				<div className="min-w-0">
					<p className="truncate text-sm font-semibold">
						{compactName(poll.user)}
					</p>
					<p className="mt-1 truncate text-xs text-[var(--c-text-muted)]">
						Morning: {poll.choices.morning} · Evening: {poll.choices.evening}
					</p>
				</div>
				<ChevronRight
					className={cx(
						"shrink-0 text-[var(--c-text-muted)] transition",
						expanded && "rotate-90",
					)}
					size={16}
				/>
			</button>
			{expanded && (
				<div className="mt-3 border-t border-[var(--c-border)] pt-3">
					<div className="grid gap-3 sm:grid-cols-2">
						{periods.map((period) => (
							<AdminPeriodControl
								key={period}
								period={period}
								drink={poll.choices[period]}
								sugar={poll.sugar[period]}
								 source={poll.sources[period]}
								availability={poll.availability[period]}
								onDrinkChange={(drink) => update(period, drink)}
									onSugarChange={(sugar) =>
									update(period, poll.choices[period], sugar)
								}
								onAvailabilityChange={(status) => updateAvailability(period, status)}
							/>
						))}
					</div>
					{isGuestUser(poll.user) && (
						<button
							onClick={removeGuest}
							type="button"
							className="mt-3 min-h-9 rounded-lg border border-[var(--c-border-err)] px-3 text-xs font-semibold text-[var(--c-text-err)]"
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
	availability,
	onDrinkChange,
	onSugarChange,
	onAvailabilityChange,
}: {
	period: Period;
	drink: Drink;
	sugar: boolean;
	source: PollSource;
	availability: AttendanceStatus;
	onDrinkChange: (drink: Drink) => void;
	onSugarChange: (sugar: boolean) => void;
	onAvailabilityChange: (status: AttendanceStatus) => void;
}) {
	return (
		<section className="rounded-xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-3">
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-xs font-semibold text-[var(--c-text-muted)]">
					{period === "morning" ? "Morning" : "Evening"}
				</h3>
				<MetaTag muted>{sourceLabel(source)}</MetaTag>
			</div>
			<label className="mt-2 block text-[11px] font-semibold text-[var(--c-text-muted)]">
				Drink choice
				<select
					aria-label={`${period} drink choice`}
					className="mt-1 h-10 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-2 text-sm font-semibold text-[var(--c-text-mid)]"
					onChange={(event) => onDrinkChange(event.target.value as Drink)}
					value={drink}
				>
					{drinks.map((item) => (
						<option key={item}>{item}</option>
					))}
				</select>
			</label>
			<label className="mt-2 block text-[11px] font-semibold text-[var(--c-text-muted)]">
				Attendance
				<select
					aria-label={`${period} attendance`}
					className="mt-1 h-9 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-2 text-xs font-semibold text-[var(--c-text-mid)]"
					onChange={(event) => onAvailabilityChange(event.target.value as AttendanceStatus)}
					value={availability}
				>
					<option value="office">In office</option>
					<option value="wfh">Working from home</option>
					<option value="leave">On leave</option>
				</select>
			</label>
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
	mobile = false,
	onPollClick,
	pianoOn = false,
}: {
	view: View;
	setView: (view: View) => void;
	admin?: boolean;
	mobile?: boolean;
	onPollClick?: () => void;
	pianoOn?: boolean;
}) {
	const items: Array<{ id: View; label: string; icon: React.ReactNode; iconActive: React.ReactNode }> = [
		{ id: "today", label: "Poll", icon: <Coffee size={22} />, iconActive: <Coffee size={22} strokeWidth={2.5} /> },
		{ id: "stats", label: "Stats", icon: <BarChart2 size={22} />, iconActive: <BarChart2 size={22} strokeWidth={2.5} /> },
		{ id: "profile", label: "Profile", icon: <UserIcon size={22} />, iconActive: <UserIcon size={22} strokeWidth={2.5} /> },
		...(!admin
			? []
			: [
					{
						id: "admin" as View,
						label: "Admin",
						icon: <ShieldCheck size={22} />,
						iconActive: <ShieldCheck size={22} strokeWidth={2.5} />,
					},
				]),
	];

	if (mobile) {
		return (
			<nav className={cx("grid", admin ? "grid-cols-4" : "grid-cols-3")}>
				{items.map((item) => {
					const active = view === item.id;
					return (
						<button
							key={item.id}
							onClick={() => item.id === "today" && onPollClick ? onPollClick() : setView(item.id)}
							type="button"
							className="relative flex flex-col items-center gap-0.5 pb-2 pt-3 transition-colors"
						>
							{active && (
								<span className="absolute inset-x-4 top-0 h-[2px] rounded-b-full bg-[var(--c-brand)]" />
							)}
							<span className={cx("relative transition-colors", active ? "text-[var(--c-brand)]" : "text-[var(--c-text-dim)]")}>
								{active ? item.iconActive : item.icon}
								{item.id === "today" && pianoOn && (
									<span className="absolute -top-1 -right-1 size-2 rounded-full bg-green-400 animate-pulse" />
								)}
							</span>
							<span className={cx("text-[10px] font-semibold tracking-wide transition-colors", active ? "text-[var(--c-brand)]" : "text-[var(--c-text-dim)]")}>
								{item.id === "today" && pianoOn ? "🎹" : item.label}
							</span>
						</button>
					);
				})}
			</nav>
		);
	}

	return (
		<nav className={cx("grid gap-2 lg:grid-cols-1", admin ? "grid-cols-4" : "grid-cols-3")}>
			{items.map((item) => (
				<button
					key={item.id}
					onClick={() => item.id === "today" && onPollClick ? onPollClick() : setView(item.id)}
					type="button"
					className={cx(
						"flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-semibold transition lg:flex-row lg:justify-start lg:gap-2 lg:px-3 lg:text-sm",
						view === item.id
							? "bg-[var(--c-brand)] text-white"
							: "text-[var(--c-text-muted)] hover:bg-[var(--c-muted)] hover:text-[var(--c-brand)]",
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
				"grid place-items-center rounded-[10px] bg-[var(--c-brand)] text-[var(--c-cream)]",
				className,
			)}
		>
			<Coffee color={iconColor} size={iconSize} strokeWidth={2.2} />
		</div>
	);
}

const brewingMessages = [
	"Grinding the beans...",
	"Brewing your coffee...",
	"Steaming the milk...",
	"Milking the cow...",
	"Heating the kettle...",
	"Steeping the tea...",
	"Frothing the milk...",
	"Tamping the espresso...",
	"Pulling the shot...",
	"Warming your cup...",
];
function pickRandom(arr: string[]) {
	return arr[Math.floor(Math.random() * arr.length)];
}

function ProfileView({
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
			<section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] shadow-[0_8px_30px_rgba(77,57,38,0.04)]">
				<div className="flex items-center gap-4 p-4">
					<button
						type="button"
						onClick={tapAvatar}
						className="grid size-14 shrink-0 place-items-center rounded-full bg-[var(--c-brand-pale)] text-lg font-semibold text-[var(--c-brand)]"
					>
						{initials(user.name)}
					</button>
					<div className="min-w-0">
						<p className="truncate font-semibold text-[var(--c-text-dark)]">{user.name}</p>
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
						<button
							type="button"
							onClick={onToggleTheme}
							aria-label="Toggle theme"
							aria-pressed={dark}
							className="relative h-6 w-11 rounded-full transition-colors duration-200"
							style={{ background: dark ? "var(--c-brand)" : "var(--c-toggle-off)" }}
						>
							<span
								className={cx(
									"absolute top-1 size-4 rounded-full bg-[var(--c-cream)] shadow transition-all duration-200",
									dark ? "left-6" : "left-1",
								)}
							/>
						</button>
					</div>

					{/* Drink defaults row */}
					{!isGuest && (
						<>
							<button
								type="button"
								onClick={() => setDefaultsOpen((o) => !o)}
								className="flex w-full items-center justify-between border-t border-[var(--c-border)] px-4 py-3.5 text-sm font-semibold text-[var(--c-text-mid)] transition hover:bg-[var(--c-muted)]"
							>
								<span className="flex items-center gap-2.5">
									<Coffee size={15} />
									Drink defaults
								</span>
								<ChevronRight
									size={15}
									className={cx("transition-transform duration-200 text-[var(--c-text-dim)]", defaultsOpen && "rotate-90")}
								/>
							</button>
							{defaultsOpen && (
								<div className="grid gap-3 border-t border-[var(--c-border)] px-4 py-4">
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
							)}
						</>
					)}

					{/* History row */}
					<>
						<button
							type="button"
							onClick={() => setHistoryOpen((o) => !o)}
							className="flex w-full items-center justify-between border-t border-[var(--c-border)] px-4 py-3.5 text-sm font-semibold text-[var(--c-text-mid)] transition hover:bg-[var(--c-muted)]"
						>
							<span className="flex items-center gap-2.5">
								<CalendarDays size={15} />
								History
							</span>
							<ChevronRight
								size={15}
								className={cx("transition-transform duration-200 text-[var(--c-text-dim)]", historyOpen && "rotate-90")}
							/>
						</button>
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
					</>

					{/* Contribute row */}
					<a
						href="https://github.com/jojipanackal/brew-book"
						target="_blank"
						rel="noopener noreferrer"
						className="flex w-full items-center gap-2.5 border-t border-[var(--c-border)] px-4 py-3.5 text-sm font-semibold text-[var(--c-text-mid)] transition hover:bg-[var(--c-muted)]"
					>
						<svg viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0" aria-hidden="true"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.461-1.11-1.461-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
						Contribute on GitHub
					</a>
					{/* Sign out row */}
					<button
						onClick={onSignOut}
						type="button"
						className="flex w-full items-center gap-2.5 border-t border-[var(--c-border)] px-4 py-3.5 text-sm font-semibold text-[var(--c-text-err)] transition hover:bg-[var(--c-err-bg)]"
					>
						<LogOut size={15} />
						Sign out
					</button>
				</div>
			</section>
		</div>
	);
}

function AuthLoading({
	message,
}: {
	message?: string;
}) {
	const [msg] = useState(() => message ?? pickRandom(brewingMessages))
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
function SignInPage({
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
		return () => { if (wasDark) html.classList.add("dark"); };
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

function AccessDeniedPage({ authError = false, onSignOut }: { authError?: boolean; onSignOut?: () => void }) {
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
function GuestPendingPage({ onExit }: { onExit: () => void }) {
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
function GuestRejectedPage({ onExit }: { onExit: () => void }) {
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
function LocalSetupComplete({ onReset }: { onReset: () => void }) {
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
function TodayView({
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
		const [h, m] = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(d).split(":").map(Number);
		return h * 60 + m;
	});
	useEffect(() => {
		const id = setInterval(() => {
			const d = new Date();
			const [h, m] = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(d).split(":").map(Number);
			setNowIST(h * 60 + m);
		}, 30_000);
		return () => clearInterval(id);
	}, []);

	const morningNotOpen = nowIST < 10 * 60 + 30;
	const morningClosed = nowIST >= 11 * 60;
	const eveningNotOpen = nowIST < 14 * 60 + 30;
	const eveningClosed = nowIST >= 15 * 60 + 15;

	const isPeriodClosed = (id: Period) => (id === "morning" ? morningNotOpen || morningClosed : eveningNotOpen || eveningClosed);

	// Twinkle Twinkle Little Star — C C G G A A G, F F E E D D C, ...
	const TWINKLE = [261.63,261.63,392.0,392.0,440.0,440.0,392.0,349.23,349.23,329.63,329.63,293.66,293.66,261.63];
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
			{!guest && <AvailabilityControl availability={availability} loading={availabilityLoading} nowIST={nowIST} onChange={onUpdateAvailability} />}
			<div className="grid gap-3">
				{(nowIST >= 12 * 60 ? [...periodDetails].reverse() : periodDetails).map((period) => (
					<div key={period.id} className="grid gap-0">
					<DrinkPoll
						period={period}
						closed={isPeriodClosed(period.id)}
						closedMessage={
							period.id === "morning"
								? morningNotOpen
									? "Poll opens at 10:30 AM"
									: morningClosed
										? "Poll closed"
										: undefined
								: eveningNotOpen
									? "Poll opens at 2:30 PM"
									: eveningClosed
										? "Poll closed"
										: undefined
						}
						polls={todayPolls}
							selected={entry[period.id]}
							sugar={sugar[period.id]}
							editable={!isPeriodClosed(period.id) && availability[period.id] === "office"}
							onSelect={isPeriodClosed(period.id) ? undefined : (drink) => (pianoMode ? pianoSelect(period.id, drink) : updateEntry(period.id, drink))}
							onToggleSugar={isPeriodClosed(period.id) ? undefined : (next) => updateSugar(period.id, next)}
							onOpen={() => onOpen(period.id)}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
function AvailabilityControl({ availability, loading, nowIST, onChange }: { availability: Record<Period, AttendanceStatus>; loading: Period | null; nowIST: number; onChange?: (period: Period, status: AttendanceStatus) => void }) {
	const labels: Record<AttendanceStatus, string> = { office: "In office", wfh: "Working from home", leave: "On leave" };
	const visiblePeriods = periods.filter((period) => period === "morning" ? nowIST < 11 * 60 : nowIST < 15 * 60 + 15);
	if (visiblePeriods.length === 0) return null;
	return (
		<details className="group rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] px-4 py-3 shadow-[0_8px_30px_rgba(77,57,38,0.03)]">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[var(--c-text-mid)]">
				<span className="flex items-center gap-2.5"><CalendarOff size={17} className="text-[var(--c-brand-lt)]" />Mark your absence</span>
				<ChevronDown size={17} className="text-[var(--c-text-muted)] transition-transform group-open:rotate-180" />
			</summary>
			<div className="mt-3 grid gap-3 border-t border-[var(--c-border-2)] pt-3 sm:grid-cols-2">
				{visiblePeriods.map((period) => (
					<label key={period} className="grid gap-1.5 text-xs font-semibold text-[var(--c-text-muted)]">
						<span>{period === "morning" ? "Morning" : "Evening"}</span>
						<select
							className="h-10 rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-2 text-sm font-semibold text-[var(--c-text-mid)]"
							disabled={loading !== null}
							value={availability[period]}
							onChange={(event) => onChange?.(period, event.target.value as AttendanceStatus)}
						>
							{(Object.keys(labels) as AttendanceStatus[]).map((status) => <option key={status} value={status}>{labels[status]}</option>)}
						</select>
						{loading === period && <Loader2 size={14} className="animate-spin text-[var(--c-brand-lt)]" />}
					</label>
				))}
			</div>
		</details>
	);
}
function MiniCalendar({ selected, onSelect }: { selected: string; onSelect: (d: string) => void }) {
	const [viewYear, setViewYear] = useState(() => Number(selected.slice(0, 4)));
	const [viewMonth, setViewMonth] = useState(() => Number(selected.slice(5, 7)) - 1);

	const todayParts = todayKey.split("-").map(Number);
	const todayY = todayParts[0], todayM = todayParts[1] - 1, todayD = todayParts[2];

	const firstDay = new Date(viewYear, viewMonth, 1).getDay();
	const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
	const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(viewYear, viewMonth));

	const canNext = viewYear < todayY || (viewYear === todayY && viewMonth < todayM);

	function prevMonth() {
		if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
		else setViewMonth((m) => m - 1);
	}
	function nextMonth() {
		if (!canNext) return;
		if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
		else setViewMonth((m) => m + 1);
	}

	const cells: Array<{ day: number | null; key: string | null; disabled: boolean; isToday: boolean; isSelected: boolean }> = [];
	for (let i = 0; i < firstDay; i++) cells.push({ day: null, key: null, disabled: true, isToday: false, isSelected: false });
	for (let d = 1; d <= daysInMonth; d++) {
		const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
		const disabled = viewYear > todayY || (viewYear === todayY && viewMonth > todayM) || (viewYear === todayY && viewMonth === todayM && d > todayD);
		cells.push({ day: d, key, disabled, isToday: viewYear === todayY && viewMonth === todayM && d === todayD, isSelected: key === selected });
	}

	return (
		<div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] p-4 shadow-[0_8px_30px_rgba(77,57,38,0.04)]">
			<div className="mb-3 flex items-center justify-between">
				<button type="button" onClick={prevMonth} className="grid size-8 place-items-center rounded-lg text-[var(--c-text-muted)] transition hover:bg-[var(--c-muted)]">
					<ArrowLeft size={14} />
				</button>
				<span className="text-sm font-semibold text-[var(--c-text-dark)]">{monthName}</span>
				<button type="button" onClick={nextMonth} disabled={!canNext} className="grid size-8 place-items-center rounded-lg text-[var(--c-text-muted)] transition hover:bg-[var(--c-muted)] disabled:opacity-30">
					<ArrowRight size={14} />
				</button>
			</div>
			<div className="mb-1 grid grid-cols-7 text-center">
				{["S","M","T","W","T","F","S"].map((d, i) => (
					<span key={i} className="text-[10px] font-semibold text-[var(--c-text-dim)]">{d}</span>
				))}
			</div>
			<div className="grid grid-cols-7 gap-y-0.5 text-center">
				{cells.map((cell, i) =>
					cell.day === null ? (
						<span key={i} />
					) : (
						<button
							key={cell.key}
							type="button"
							disabled={cell.disabled}
							onClick={() => cell.key && onSelect(cell.key)}
							className={cx(
								"mx-auto flex size-8 items-center justify-center rounded-full text-xs font-semibold transition",
								cell.isSelected
									? "bg-[var(--c-brand)] text-white"
									: cell.isToday
									? "bg-[var(--c-accent-bg)] text-[var(--c-brand)]"
									: cell.disabled
									? "text-[var(--c-text-dim)] opacity-30"
									: "text-[var(--c-text)] hover:bg-[var(--c-muted)]",
							)}
						>
							{cell.day}
						</button>
					)
				)}
			</div>
		</div>
	);
}

const drinkColors: Partial<Record<Drink, string>> = {
	Tea: "#a36f43",
	Coffee: "#5a3c26",
	"Green tea": "#5a7a3c",
	Milk: "#c8956a",
	"Black Coffee": "#2d2925",
	"Black Tea": "#68452e",
	"No drink": "#dbc9b6",
};

const healthAdvice: Record<string, string[]> = {
	Tea: ["Great antioxidant choice", "Try without sugar for max benefits", "Ideal for steady afternoon energy"],
	Coffee: ["Best enjoyed before noon to protect sleep", "Pair with food to reduce acidity", "2 cups/day is a sweet spot for most"],
	"Green tea": ["Best drunk between meals, not with food", "L-theanine gives calm, sustained focus", "Avoid adding milk, it reduces antioxidants"],
	Milk: ["Good protein and calcium source", "Consider low-fat if watching calories", "Great post-workout recovery drink"],
	"Black Coffee": ["Zero-calorie fuel", "Wait 90 min after waking before first cup", "Avoid after 2pm to protect sleep"],
	"Black Tea": ["Strong antioxidant profile", "Have it without sugar for best effect", "Drink between meals to maximise iron absorption"],
	"No drink": ["Hydrate with water instead", "Consider herbal teas for variety", "Skipping caffeine occasionally is healthy"],
};

function StatsView() {
	const [stats, setStats] = useState<import("#/routes/api/stats").StatsResponse | null>(null);
	const [fetching, setFetching] = useState(true);
	const [range, setRange] = useState(30);

	useEffect(() => {
		setFetching(true);
		void getStats(range)
			.then(setStats)
			.finally(() => setFetching(false));
	}, [range]);

	if (fetching && !stats) return (
		<div className="grid min-h-[50svh] place-items-center">
			<div className="flex flex-col items-center gap-3">
				<output aria-label="Loading" className="size-10 animate-spin rounded-full border-2 border-[var(--c-border)] border-t-[var(--c-brand)]" />
				<p className="text-sm text-[var(--c-text-muted)]">{pickRandom(brewingMessages)}</p>
			</div>
		</div>
	);
	if (!stats) return null;

	const topDrinks = drinks
		.filter((d) => d !== "No drink")
		.map((d) => ({ drink: d, count: stats.byDrink[d] ?? 0 }))
		.filter((d) => d.count > 0)
		.sort((a, b) => b.count - a.count);

	const maxCount = Math.max(...topDrinks.map((d) => d.count), 1);
	const mostCommon = topDrinks[0]?.drink;
	const advice = mostCommon ? healthAdvice[mostCommon] ?? [] : [];

	return (
		<div className="grid gap-5">
			<PageHeader eyebrow="Your data" title="Stats" />

			{/* Range selector */}
			<div className="flex items-center gap-2">
				{([7, 30, 90] as const).map((d) => (
					<button
						key={d}
						type="button"
						onClick={() => setRange(d)}
						className={cx(
							"flex-1 rounded-xl border py-2 text-sm font-semibold transition",
							range === d
								? "border-[var(--c-brand)] bg-[var(--c-brand)] text-white"
								: "border-[var(--c-border)] text-[var(--c-text-muted)] hover:bg-[var(--c-muted)]",
						)}
					>
						{d}d
					</button>
				))}
				{fetching && <Loader2 size={16} className="shrink-0 animate-spin text-[var(--c-brand-lt)]" />}
			</div>

			{/* Summary cards */}
			<div className="grid grid-cols-3 gap-2">
				<div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] px-3 py-3 text-center">
					<p className="text-2xl font-bold text-[var(--c-brand)]">{stats.streak}</p>
					<p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--c-text-dim)]">Day streak</p>
				</div>
				<div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] px-3 py-3 text-center">
					<p className="text-2xl font-bold text-[var(--c-brand)]">{stats.totalDays}</p>
					<p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--c-text-dim)]">Days logged</p>
				</div>
				<div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] px-3 py-3 text-center">
					<p className="text-2xl font-bold text-[var(--c-brand)]">{stats.sugarRate}%</p>
					<p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--c-text-dim)]">With sugar</p>
				</div>
			</div>

			{/* Bar chart */}
			{topDrinks.length > 0 && (
				<section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] p-4">
					<h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--c-brand-lt)]">Drink breakdown</h3>
					<div className="grid gap-2.5">
						{topDrinks.map(({ drink, count }) => (
							<div key={drink}>
								<div className="mb-1 flex items-center justify-between text-xs font-semibold">
									<span className="text-[var(--c-text-mid)]">{drink}</span>
									<span className="text-[var(--c-text-dim)]">{count}×</span>
								</div>
								<div className="h-2 w-full overflow-hidden rounded-full bg-[var(--c-muted)]">
									<div
										className="h-full rounded-full transition-all duration-500"
										style={{
											width: `${Math.round((count / maxCount) * 100)}%`,
											background: drinkColors[drink] ?? "var(--c-brand)",
										}}
									/>
								</div>
							</div>
						))}
					</div>
				</section>
			)}

			{/* Morning vs Evening split */}
			{topDrinks.length > 0 && (
				<section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] p-4">
					<h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--c-brand-lt)]">Morning vs Evening</h3>
					<div className="grid grid-cols-2 gap-4">
						{(["morning", "evening"] as const).map((period) => {
							const periodCounts = stats.byPeriod[period];
							const top = drinks
								.map((d) => ({ drink: d, count: periodCounts[d] ?? 0 }))
								.filter((d) => d.count > 0)
								.sort((a, b) => b.count - a.count)
								.slice(0, 3);
							return (
								<div key={period}>
									<p className="mb-2 text-xs font-semibold capitalize text-[var(--c-text-muted)]">{period}</p>
									{top.map(({ drink, count }) => (
										<div key={drink} className="mb-1 flex items-center gap-2 text-xs">
											<span
												className="size-2 shrink-0 rounded-full"
												style={{ background: drinkColors[drink] ?? "var(--c-brand)" }}
											/>
											<span className="min-w-0 truncate text-[var(--c-text-mid)]">{drink}</span>
											<span className="ml-auto shrink-0 text-[var(--c-text-dim)]">{count}</span>
										</div>
									))}
								</div>
							);
						})}
					</div>
				</section>
			)}

			{/* Health advice */}
			{advice.length > 0 && (
				<section className="rounded-2xl border border-[var(--c-border-2)] bg-[var(--c-accent-bg)] p-4">
					<h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--c-brand-lt)]">
						Health tips · {mostCommon}
					</h3>
					<ul className="grid gap-2">
						{advice.map((tip) => (
							<li key={tip} className="flex items-start gap-2 text-sm text-[var(--c-text-mid)]">
								<Coffee size={13} className="mt-0.5 shrink-0 text-[var(--c-brand-lt)]" />
								{tip}
							</li>
						))}
					</ul>
				</section>
			)}

			{stats.totalDays === 0 && (
				<div className="rounded-2xl border border-dashed border-[var(--c-empty)] bg-[var(--c-card)] px-4 py-10 text-center text-sm text-[var(--c-text-muted)]">
					No data yet. Start logging your drinks!
				</div>
			)}
		</div>
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
				<span className="text-sm font-semibold text-[var(--c-text-dark)]">{displayDate(date)}</span>
				{polls.length > 0 && (
					<span className="text-xs text-[var(--c-text-muted)]">{polls.length} people</span>
				)}
			</div>
			<MiniCalendar selected={date} onSelect={setDate} />
			{loading ? (
				<div className="flex items-center justify-center py-8">
					<Loader2 size={24} className="animate-spin text-[var(--c-brand-lt)]" />
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
	if (!polls.length)
		return (
			<div className="rounded-2xl border border-dashed border-[var(--c-empty)] bg-[var(--c-card)] px-4 py-8 text-center text-sm text-[var(--c-text-muted)]">
				No responses for this day.
			</div>
		);
	return (
		<div className="grid gap-3">
			{rows.map((group) => (
				<article
					className="overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] shadow-[0_8px_30px_rgba(77,57,38,0.04)]"
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
						<span className="text-sm font-semibold text-[var(--c-text-dark)]">
							{group.drink}
						</span>
						<span className="text-xs font-semibold text-[var(--c-text-muted)]">
							{group.entries.length}
						</span>
					</button>
					{openDrink === group.drink && (
						<div className="grid gap-2 border-t border-[var(--c-border-2)] p-3">
							{group.entries.map((entry) => (
								<div
									className="flex items-center justify-between gap-3 rounded-xl bg-[var(--c-row)] px-3 py-2.5"
									key={`${entry.user.email}-${entry.period}`}
								>
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
								</div>
							))}
						</div>
					)}
				</article>
			))}
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
		<section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] p-4 shadow-[0_8px_30px_rgba(77,57,38,0.04)] sm:p-5">
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-start gap-3">
					<span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--c-muted)] text-[var(--c-brand-lt)]">
						<Coffee size={17} />
					</span>
					<h2 className="pt-1 text-sm font-semibold text-[var(--c-text-dark)]">
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
								? "border-[var(--c-brand-lt)] bg-[var(--c-accent-bg)] text-[var(--c-text-mid)]"
								: "border-[var(--c-border-2)] text-[var(--c-text-soft)] hover:border-[var(--c-border-3)]",
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
		<div className="flex items-end justify-between gap-4 border-b border-[var(--c-border)] pb-4">
			<div>
				<p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--c-brand-lt)]">
					{eyebrow}
				</p>
				<h1 className="mt-1 font-serif text-3xl tracking-[-0.03em] text-[var(--c-text-dark)] sm:text-4xl">
					{title}
				</h1>
			</div>
			{action && (
				<span className="shrink-0 text-xs font-semibold text-[var(--c-text-dim)]">
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
					? "flex shrink-0 items-center gap-2 text-xs font-semibold text-[var(--c-text-mid)]"
					: "mt-3 flex min-h-10 w-full items-center justify-between rounded-xl border border-[var(--c-border)] px-3 text-left transition hover:border-[var(--c-brand-lt)]",
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
					<span className="block text-xs text-[var(--c-text-dim)]">
						{sugar ? "Off" : "On"}
					</span>
				)}
			</span>
			<span
				className={cx(
					"relative h-6 w-11 rounded-full transition",
					sugar ? "bg-[var(--c-toggle-off)]" : "bg-[var(--c-brand-lt)]",
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
	const activePolls = polls.filter((entry) => entry.availability[period.id] === "office");
	const counts = countChoices(activePolls.map((entry) => entry.choices))[period.id];
	const unavailableCount = polls.length - activePolls.length;
	const total = activePolls.length;
	const [infoDrink, setInfoDrink] = useState<Drink | null>(null);
	const pollUpcoming = closedMessage.startsWith("Poll opens");
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
							{total} {total === 1 ? "response" : "responses"}{unavailableCount ? ` · ${unavailableCount} away` : ""}
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
				<div className={cx(
					"flex items-center gap-2 border-b px-4 py-2.5 text-xs font-semibold sm:px-5",
					pollUpcoming
						? "border-green-200 bg-green-50 text-green-700"
						: "border-red-200 bg-red-50 text-red-700",
				)}>
					<span className={cx("size-1.5 rounded-full", pollUpcoming ? "bg-green-600" : "bg-red-600")} />
					{closedMessage}
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
			{infoDrink && <DrinkInfoSheet drink={infoDrink} onClose={() => setInfoDrink(null)} />}
		</div>
	);
}

// Parse a CSS hex color to normalized RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const n = parseInt(hex.replace("#", ""), 16);
	return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function GlassEasterEgg({ onClose }: { onClose: () => void }) {
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
	useEffect(() => { tiltRef.current = tilt; }, [tilt]);

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
		const foam = { r: Math.min(1, color.r + 0.35), g: Math.min(1, color.g + 0.25), b: Math.min(1, color.b + 0.2) };

		fluidRef.current = setupFluidScene(simWidthRef.current, simHeightRef.current, 60, 0.6, 0.75, color, foam, 0.0008, 0.4);
		rendererRef.current = new FluidRenderer(canvas);

		const dt = 1.0 / 120.0;

		function loop() {
			const f = fluidRef.current;
			const r = rendererRef.current;
			if (!f || !r) return;

			const gx = (tiltRef.current.gamma / 45) * 9.81;
			const gy = -9.81;

			f.simulate(dt, gx, gy, 0.95, 50, 2, 1.7, true, true, 1.0);
			r.render(f, { simWidth: simWidthRef.current, simHeight: simHeightRef.current });
			rafRef.current = requestAnimationFrame(loop);
		}
		rafRef.current = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(rafRef.current);
			fluidRef.current = null;
			rendererRef.current = null;
		};
	}, [permission]);

	// Update fluid color when drink changes
	useEffect(() => {
		const f = fluidRef.current;
		if (!f) return;
		const color = hexToRgb(drinkColors[activeDrink] ?? "#a36f43");
		const foam = { r: Math.min(1, color.r + 0.35), g: Math.min(1, color.g + 0.25), b: Math.min(1, color.b + 0.2) };
		f.setFluidColor(color);
		f.setFoamColor(foam);
	}, [activeDrink]);

	// Permission-first screen
	if (permission !== "granted") {
		return (
			<div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[var(--c-page)] px-8 text-center" style={{ paddingTop: "env(safe-area-inset-top)" }}>
				<button type="button" onClick={onClose} className="absolute right-5 top-5 text-sm font-semibold text-[var(--c-text-muted)] transition hover:text-[var(--c-brand)]">
					Close
				</button>
				<div className="grid size-20 place-items-center rounded-full bg-[var(--c-accent-bg)] text-[var(--c-brand)]">
					<Coffee size={36} />
				</div>
				<div>
					<h2 className="font-serif text-2xl font-bold text-[var(--c-text-dark)]">Glass Simulator</h2>
					<p className="mt-2 text-sm text-[var(--c-text-muted)]">Tilt your phone to swirl your drink.<br />Tilt forward to take a sip.</p>
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
					<p className="text-sm text-[var(--c-text-err)]">Permission denied. Enable Motion in iOS Settings.</p>
				)}
			</div>
		);
	}

	const drinkHex = drinkColors[activeDrink] ?? "#a36f43";

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-[var(--c-page)]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
			{/* SVG defs for metaball filter */}
			<svg width="0" height="0" className="absolute">
				<defs>
					<filter id="fluid-metaball" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
						<feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
						<feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 28 -10" result="blob" />
					</filter>
					<clipPath id="glass-clip" clipPathUnits="objectBoundingBox">
						{/* trapezoid: top wider, bottom narrower — glass shape */}
						<polygon points="0.08,0 0.92,0 0.82,1 0.18,1" />
					</clipPath>
				</defs>
			</svg>

			{/* Header */}
			<div className="flex items-center justify-between border-b border-[var(--c-border)] px-5 py-4">
				<span className="font-serif text-lg font-bold text-[var(--c-brand)]">Glass Simulator</span>
				<button type="button" onClick={onClose} className="text-sm font-semibold text-[var(--c-text-muted)] transition hover:text-[var(--c-brand)]">
					Done
				</button>
			</div>

			{/* Glass area */}
			<div className="flex flex-1 flex-col items-center justify-center gap-4 px-8">
				<p className="text-sm font-semibold text-[var(--c-text-mid)]">{activeDrink}</p>

				{/* Glass wrapper: fixed proportions, glass clip + metaball */}
				<div className="relative" style={{ width: 260, height: 380 }}>
					{/* Glass border SVG overlay */}
					<svg
						viewBox="0 0 260 380"
						width="260" height="380"
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
						<line x1="48" y1="12" x2="58" y2="345" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.18" />
						<line x1="66" y1="5" x2="72" y2="70" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.14" />
					</svg>

					{/* Canvas inside glass with metaball filter + clip */}
					<div
						className="absolute inset-0 overflow-hidden"
						style={{
							clipPath: "polygon(8% 0%, 92% 0%, 82% 100%, 18% 100%)",
						}}
					>
						<div style={{ filter: "url(#fluid-metaball)", width: "100%", height: "100%", background: "transparent" }}>
							<canvas
								ref={canvasRef}
								style={{ width: "100%", height: "100%", display: "block", background: "transparent" }}
							/>
						</div>
					</div>
				</div>

				<p className="text-xs text-[var(--c-text-dim)]">Tilt to swirl</p>
			</div>

			{/* Drink picker */}
			<div className="border-t border-[var(--c-border)] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
				<p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-[var(--c-text-dim)]">Pick a drink</p>
				<div className="flex flex-wrap justify-center gap-2">
					{drinks.filter((d) => d !== "No drink").map((d) => (
						<button
							key={d}
							type="button"
							onClick={() => setActiveDrink(d)}
							style={activeDrink === d ? { background: drinkHex, borderColor: drinkHex, color: "white" } : undefined}
							className={cx(
								"rounded-full border px-3 py-1.5 text-xs font-semibold transition",
								activeDrink !== d && "border-[var(--c-border)] text-[var(--c-text-muted)] hover:bg-[var(--c-muted)]",
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

function DrinkInfoSheet({ drink, onClose }: { drink: Drink; onClose: () => void }) {
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
			<button className="absolute inset-0 cursor-default bg-[var(--c-text)]/30 [touch-action:none]" onClick={onClose} type="button" aria-label="Close" />
			<section
				className="no-scrollbar relative z-10 flex h-[88svh] w-full flex-col overflow-y-auto rounded-t-3xl bg-[var(--c-card)] overscroll-contain shadow-2xl sm:h-auto sm:max-h-[88svh] sm:max-w-lg sm:rounded-2xl"
				style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined, transition: dragY === 0 ? "transform 0.25s ease" : "none" }}
			>
				{/* Handle */}
				<div
					className="mx-auto mt-3 h-1 w-10 shrink-0 touch-none rounded-full bg-[var(--c-drag)] sm:hidden"
					onTouchStart={handleTouchStart}
					onTouchMove={handleTouchMove}
					onTouchEnd={handleTouchEnd}
				/>

				{/* Hero */}
				<div className="flex flex-col items-center gap-2 bg-[var(--c-accent-bg)] px-6 py-8 text-center">
					<span className="grid size-16 place-items-center rounded-full bg-[var(--c-card)] text-[var(--c-brand)]">
						<Coffee size={32} />
					</span>
					<h2 className="mt-1 font-serif text-2xl font-bold text-[var(--c-text-dark)]">{drink}</h2>
					<p className="text-sm text-[var(--c-text-muted)]">{info.tagline}</p>
				</div>

				<div className="grid gap-5 px-4 py-5 sm:px-6">
					{/* Nutrition */}
					<div>
						<h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--c-brand-lt)]">Nutrition per cup</h3>
						<div className="grid grid-cols-2 gap-2">
							{info.nutrition.map((n) => (
								<div key={n.label} className="rounded-xl bg-[var(--c-row)] px-3 py-2.5">
									<p className="text-[11px] text-[var(--c-text-dim)]">{n.label}</p>
									<p className="mt-0.5 text-sm font-semibold text-[var(--c-text-dark)]">{n.value}</p>
								</div>
							))}
						</div>
					</div>

					{/* Pros */}
					<div>
						<h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--c-brand-lt)]">Pros</h3>
						<ul className="grid gap-1.5">
							{info.pros.map((p) => (
								<li key={p} className="flex items-start gap-2 text-sm text-[var(--c-text)]">
									<Check size={13} className="mt-0.5 shrink-0 text-green-600" />
									{p}
								</li>
							))}
						</ul>
					</div>

					{/* Cons */}
					<div>
						<h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--c-brand-lt)]">Cons</h3>
						<ul className="grid gap-1.5">
							{info.cons.map((c) => (
								<li key={c} className="flex items-start gap-2 text-sm text-[var(--c-text)]">
									<XIcon size={13} className="mt-0.5 shrink-0 text-[var(--c-text-err)]" />
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
	const [dragY, setDragY] = useState(0);
	const dragStart = useState<number | null>(null);
	const periodInfo = periodDetails.find((item) => item.id === period);
	const filteredPolls =
		sourceFilter === "all"
			? polls
			: polls.filter((item) => item.sources[period] === sourceFilter);
	const awayPolls = filteredPolls.filter((item) => item.availability[period] !== "office");

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
				style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined, transition: dragY === 0 ? "transform 0.25s ease" : "none" }}
			>
				<div className="shrink-0 border-b border-[var(--c-border-2)] pb-4">
					<div
						className="[touch-action:none]"
						onTouchStart={handleTouchStart}
						onTouchMove={handleTouchMove}
						onTouchEnd={handleTouchEnd}
					>
						<div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-[var(--c-drag)] sm:hidden" />
						<div className="flex items-start justify-between">
							<div>
								<p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--c-brand-lt)]">
									{date === todayKey ? "Today" : displayDate(date)}
								</p>
								<h2 className="mt-1 font-serif text-2xl text-[var(--c-text-dark)]">
									{periodInfo?.label ?? period}
								</h2>
								<p className="mt-1 text-sm text-[var(--c-text-dim)]">
									{filteredPolls.length}{" "}
									{filteredPolls.length === 1 ? "response" : "responses"}
								</p>
							</div>
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
				</div>
				<div className="no-scrollbar mt-4 min-h-0 flex-1 grid content-start gap-4 overflow-y-auto overscroll-contain [touch-action:pan-y]">
					{awayPolls.length > 0 && (
						<section>
							<h3 className="mb-2 text-base font-semibold text-[var(--c-text-muted)]">Not ordering this round</h3>
							<div className="grid gap-2">
								{awayPolls.map((item) => <div className="flex items-center justify-between rounded-xl bg-[var(--c-row)] px-3 py-2.5" key={item.user.email}><span className="text-sm font-semibold">{compactName(item.user)}</span><MetaTag muted>{availabilityLabel(item.availability[period])}</MetaTag></div>)}
							</div>
						</section>
					)}
					{drinks.map((drink) => {
						const drinkPolls = filteredPolls.filter(
							(item) => item.availability[period] === "office" && item.choices[period] === drink,
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
												<MetaTag>{item.sugar[period] ? "Sugar" : "No sugar"}</MetaTag>
												<MetaTag muted>{sourceLabel(item.sources[period])}</MetaTag>
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
