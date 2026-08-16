import type { Drink, Period, PollSource } from "#/lib/drinks";
import type { AppState, DrinkInfo } from "./types";

export const periodDetails: Array<{
	id: Period;
	label: string;
	helper: string;
}> = [
	{ id: "morning", label: "Morning", helper: "Before the first prep round" },
	{ id: "evening", label: "Evening", helper: "For the afternoon round" },
];

export const drinkInfo: Partial<Record<Drink, DrinkInfo>> = {
	Tea: {
		tagline: "Classic comfort in every sip",
		nutrition: [
			{ label: "Calories", value: "2 kcal" },
			{ label: "Caffeine", value: "20–50 mg" },
			{ label: "Antioxidants", value: "High" },
			{ label: "Sugar (plain)", value: "0 g" },
		],
		pros: [
			"Rich in antioxidants",
			"Mild caffeine boost",
			"Supports hydration",
			"May improve focus",
		],
		cons: [
			"Tannins can reduce iron absorption",
			"Can stain teeth",
			"May cause jitteriness in excess",
		],
	},
	Coffee: {
		tagline: "Your daily fuel",
		nutrition: [
			{ label: "Calories", value: "5 kcal" },
			{ label: "Caffeine", value: "80–100 mg" },
			{ label: "Antioxidants", value: "Very High" },
			{ label: "Sugar (plain)", value: "0 g" },
		],
		pros: [
			"Strong alertness boost",
			"Rich in antioxidants",
			"May improve metabolism",
			"Linked to reduced diabetes risk",
		],
		cons: [
			"Can cause anxiety or jitters",
			"May disrupt sleep",
			"Acidic, can irritate stomach",
			"Habit-forming",
		],
	},
	"Green tea": {
		tagline: "Calm energy, ancient wisdom",
		nutrition: [
			{ label: "Calories", value: "0 kcal" },
			{ label: "Caffeine", value: "15–30 mg" },
			{ label: "L-theanine", value: "High" },
			{ label: "Antioxidants", value: "Very High" },
		],
		pros: [
			"L-theanine promotes calm focus",
			"Powerful antioxidant EGCG",
			"Supports metabolism",
			"Gentle on stomach",
		],
		cons: [
			"Lower caffeine than coffee",
			"Can taste bitter if over-steeped",
			"May interfere with iron absorption",
		],
	},
	Milk: {
		tagline: "Strong bones, warm soul",
		nutrition: [
			{ label: "Calories", value: "61 kcal" },
			{ label: "Protein", value: "3.2 g" },
			{ label: "Calcium", value: "113 mg" },
			{ label: "Fat", value: "3.3 g" },
		],
		pros: [
			"Excellent source of calcium",
			"Complete protein",
			"Supports bone health",
			"Filling and nourishing",
		],
		cons: [
			"Higher calorie than other drinks",
			"Lactose intolerant? Skip it",
			"Full-fat adds saturated fat",
		],
	},
	"Black Coffee": {
		tagline: "Pure. Bold. Unapologetic.",
		nutrition: [
			{ label: "Calories", value: "2 kcal" },
			{ label: "Caffeine", value: "80–100 mg" },
			{ label: "Fat", value: "0 g" },
			{ label: "Sugar", value: "0 g" },
		],
		pros: [
			"Zero calories",
			"Maximum caffeine hit",
			"Sharpens mental clarity",
			"Rich in antioxidants",
		],
		cons: [
			"Very acidic",
			"Can cause heartburn",
			"May raise blood pressure",
			"Bitter taste not for everyone",
		],
	},
	"Black Tea": {
		tagline: "Bold, robust, timeless",
		nutrition: [
			{ label: "Calories", value: "2 kcal" },
			{ label: "Caffeine", value: "40–70 mg" },
			{ label: "Antioxidants", value: "High" },
			{ label: "Sugar (plain)", value: "0 g" },
		],
		pros: [
			"Higher caffeine than green tea",
			"Good gut health support",
			"Heart-healthy antioxidants",
			"Rich robust flavour",
		],
		cons: [
			"Tannins reduce iron absorption",
			"Can stain teeth",
			"May cause acid reflux",
		],
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

export const dateFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Asia/Kolkata",
});
export const displayDateFormatter = new Intl.DateTimeFormat("en-US", {
	weekday: "short",
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "Asia/Kolkata",
});
export const todayKey = dateFormatter.format(new Date());

export const initialState: AppState = {
	user: null,
	defaults: { morning: "No drink", evening: "No drink" },
	sugarDefaults: { morning: true, evening: true },
	entries: {},
};

export const sourceFilters: Array<PollSource | "all"> = [
	"all",
	"default",
	"manual",
	"admin",
];

export const brewingMessages = [
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

export const drinkColors: Partial<Record<Drink, string>> = {
	Tea: "#a36f43",
	Coffee: "#5a3c26",
	"Green tea": "#5a7a3c",
	Milk: "#c8956a",
	"Black Coffee": "#2d2925",
	"Black Tea": "#68452e",
	"No drink": "#dbc9b6",
};

export const healthAdvice: Record<string, string[]> = {
	Tea: [
		"Great antioxidant choice",
		"Try without sugar for max benefits",
		"Ideal for steady afternoon energy",
	],
	Coffee: [
		"Best enjoyed before noon to protect sleep",
		"Pair with food to reduce acidity",
		"2 cups/day is a sweet spot for most",
	],
	"Green tea": [
		"Best drunk between meals, not with food",
		"L-theanine gives calm, sustained focus",
		"Avoid adding milk, it reduces antioxidants",
	],
	Milk: [
		"Good protein and calcium source",
		"Consider low-fat if watching calories",
		"Great post-workout recovery drink",
	],
	"Black Coffee": [
		"Zero-calorie fuel",
		"Wait 90 min after waking before first cup",
		"Avoid after 2pm to protect sleep",
	],
	"Black Tea": [
		"Strong antioxidant profile",
		"Have it without sugar for best effect",
		"Drink between meals to maximise iron absorption",
	],
	"No drink": [
		"Hydrate with water instead",
		"Consider herbal teas for variety",
		"Skipping caffeine occasionally is healthy",
	],
};
