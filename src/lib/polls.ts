import {
	type Drink,
	type DrinkChoice,
	drinks,
	type Period,
	type PollRecord,
	type PollSource,
	periods,
	type SugarChoice,
	type User,
} from "#/lib/drinks";

function isSameUser(left: User, right: User) {
	return left.id && right.id
		? left.id === right.id
		: left.email === right.email;
}

export function upsertPollResponse({
	polls,
	user,
	defaults,
	sugarDefaults,
	period,
	drink,
	sugar,
	source = "manual",
}: {
	polls: PollRecord[];
	user: User;
	defaults: DrinkChoice;
	sugarDefaults: SugarChoice;
	period: Period;
	drink: Drink;
	sugar: boolean;
	source?: PollSource;
}) {
	const existing = polls.find((poll) => isSameUser(poll.user, user));
	const updated: PollRecord = {
		user,
		choices: { ...(existing?.choices ?? defaults), [period]: drink },
		sugar: {
			...(existing?.sugar ?? sugarDefaults),
			[period]: drink === "No drink" ? true : sugar,
		},
		sources: {
			...(existing?.sources ?? { morning: "default", evening: "default" }),
			[period]: source,
		},
	};

	if (!existing) return [...polls, updated];
	return polls.map((poll) => (isSameUser(poll.user, user) ? updated : poll));
}

export function countChoices(polls: PollRecord[]) {
	return periods.reduce(
		(result, period) => {
			result[period] = drinks.reduce<Record<Drink, number>>(
				(counts, drink) => {
					counts[drink] = polls.filter(
						(poll) => poll.choices[period] === drink,
					).length;
					return counts;
				},
				{} as Record<Drink, number>,
			);
			return result;
		},
		{} as Record<Period, Record<Drink, number>>,
	);
}

export function mergePendingPollResponses({
	serverPolls,
	currentPolls,
	user,
	defaults,
	sugarDefaults,
	pendingPeriods,
}: {
	serverPolls: PollRecord[];
	currentPolls: PollRecord[];
	user: User;
	defaults: DrinkChoice;
	sugarDefaults: SugarChoice;
	pendingPeriods: Iterable<Period>;
}) {
	const optimisticPoll = currentPolls.find((poll) =>
		isSameUser(poll.user, user),
	);
	if (!optimisticPoll) return serverPolls;

	let merged = serverPolls;
	for (const period of pendingPeriods) {
		merged = upsertPollResponse({
			polls: merged,
			user,
			defaults,
			sugarDefaults,
			period,
			drink: optimisticPoll.choices[period],
			sugar: optimisticPoll.sugar[period],
			source: optimisticPoll.sources[period],
		});
	}
	return merged;
}

export function getBrewSummary(polls: PollRecord[]) {
	const drinkCounts = new Map<Drink, number>();
	let cups = 0;
	let sugarFreeCups = 0;

	for (const poll of polls) {
		for (const period of periods) {
			const drink = poll.choices[period];
			if (drink === "No drink") continue;
			cups += 1;
			if (!poll.sugar[period]) sugarFreeCups += 1;
			drinkCounts.set(drink, (drinkCounts.get(drink) ?? 0) + 1);
		}
	}

	const topDrink =
		drinks
			.filter((drink) => drink !== "No drink")
			.map((drink) => ({ drink, count: drinkCounts.get(drink) ?? 0 }))
			.sort(
				(left, right) =>
					right.count - left.count ||
					drinks.indexOf(left.drink) - drinks.indexOf(right.drink),
			)[0] ?? null;

	return {
		people: polls.length,
		cups,
		sugarFreeCups,
		topDrink: topDrink?.count ? topDrink : null,
	};
}
