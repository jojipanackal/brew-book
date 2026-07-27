import type { DrinkChoice, PollRecord, SugarChoice, User } from "#/lib/drinks";

export const demoUser: User = {
	id: "local-demo-user",
	name: "Alex Morgan",
	email: "alex@mybev.demo",
	role: "user",
};

const demoColleagues: Array<{
	user: User;
	choices: DrinkChoice;
	sugar: SugarChoice;
}> = [
	{
		user: { id: "demo-1", name: "Maya Thomas", email: "maya@mybev.demo" },
		choices: { morning: "Tea", evening: "Green tea" },
		sugar: { morning: true, evening: false },
	},
	{
		user: { id: "demo-2", name: "Noah Joseph", email: "noah@mybev.demo" },
		choices: { morning: "Coffee", evening: "Black Coffee" },
		sugar: { morning: false, evening: false },
	},
	{
		user: { id: "demo-3", name: "Isha Nair", email: "isha@mybev.demo" },
		choices: { morning: "Coffee", evening: "Tea" },
		sugar: { morning: true, evening: true },
	},
	{
		user: { id: "demo-4", name: "Ravi Menon", email: "ravi@mybev.demo" },
		choices: { morning: "Black Tea", evening: "No drink" },
		sugar: { morning: false, evening: true },
	},
	{
		user: { id: "demo-5", name: "Sara George", email: "sara@mybev.demo" },
		choices: { morning: "Milk", evening: "Green tea" },
		sugar: { morning: true, evening: false },
	},
];

export function createDemoPolls(
	user: User,
	defaults: DrinkChoice,
	sugarDefaults: SugarChoice,
): PollRecord[] {
	return [
		...demoColleagues.map((colleague, index) => ({
			...colleague,
			sources: {
				morning: index % 2 ? ("manual" as const) : ("default" as const),
				evening: index % 3 ? ("default" as const) : ("manual" as const),
			},
		})),
		{
			user,
			choices: defaults,
			sugar: sugarDefaults,
			sources: { morning: "default", evening: "default" },
		},
	];
}
