import type {
	Company,
	DrinkChoice,
	Period,
	PollRecord,
	SugarChoice,
	User,
} from "#/lib/drinks";

export type AppState = {
	user: User | null;
	defaults: DrinkChoice;
	sugarDefaults: SugarChoice;
	entries: Record<string, PollRecord[]>;
};

export type View = "today" | "stats" | "profile" | "admin";
export type OpenPoll = { date: string; period: Period } | null;

export type OnboardingState = {
	company: Company | "";
	defaults: DrinkChoice;
	sugarDefaults: SugarChoice;
	step: "company" | "morning" | "evening";
};

export type DrinkInfo = {
	tagline: string;
	nutrition: Array<{ label: string; value: string }>;
	pros: string[];
	cons: string[];
};
