import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PollRecord, User } from "#/lib/drinks";
import {
	getBrewSummary,
	mergePendingPollResponses,
	upsertPollResponse,
} from "#/lib/polls";

const user: User = { id: "1", name: "Alex", email: "alex@example.com" };
const defaults = { morning: "Tea", evening: "No drink" } as const;
const sugarDefaults = { morning: true, evening: true };

describe("poll helpers", () => {
	it("creates an optimistic response when the user has no response yet", () => {
		const result = upsertPollResponse({
			polls: [],
			user,
			defaults,
			sugarDefaults,
			period: "morning",
			drink: "Coffee",
			sugar: false,
		});

		assert.equal(result.length, 1);
		assert.deepEqual(result[0]?.choices, {
			morning: "Coffee",
			evening: "No drink",
		});
		assert.equal(result[0]?.sources.morning, "manual");
	});

	it("keeps the other period intact when a response changes", () => {
		const polls: PollRecord[] = [
			{
				user,
				choices: { morning: "Tea", evening: "Milk" },
				sugar: { morning: true, evening: true },
				sources: { morning: "default", evening: "default" },
			},
		];
		const result = upsertPollResponse({
			polls,
			user,
			defaults,
			sugarDefaults,
			period: "morning",
			drink: "Black Coffee",
			sugar: false,
		});

		assert.equal(result[0]?.choices.evening, "Milk");
		assert.equal(result[0]?.choices.morning, "Black Coffee");
	});

	it("summarizes cups, sugar-free choices, and the top drink", () => {
		const polls: PollRecord[] = [
			{
				user,
				choices: { morning: "Coffee", evening: "Tea" },
				sugar: { morning: false, evening: true },
				sources: { morning: "manual", evening: "default" },
			},
			{
				user: { id: "2", name: "Maya", email: "maya@example.com" },
				choices: { morning: "Coffee", evening: "No drink" },
				sugar: { morning: true, evening: true },
				sources: { morning: "default", evening: "default" },
			},
		];

		assert.deepEqual(getBrewSummary(polls), {
			people: 2,
			cups: 3,
			sugarFreeCups: 1,
			topDrink: { drink: "Coffee", count: 2 },
		});
	});

	it("keeps a pending period when a server refresh arrives", () => {
		const currentPolls: PollRecord[] = [
			{
				user,
				choices: { morning: "Black Coffee", evening: "Green tea" },
				sugar: { morning: false, evening: false },
				sources: { morning: "manual", evening: "manual" },
			},
		];
		const serverPolls: PollRecord[] = [
			{
				user,
				choices: { morning: "Black Coffee", evening: "Tea" },
				sugar: { morning: false, evening: true },
				sources: { morning: "manual", evening: "default" },
			},
		];

		const result = mergePendingPollResponses({
			serverPolls,
			currentPolls,
			user,
			defaults,
			sugarDefaults,
			pendingPeriods: ["evening"],
		});

		assert.equal(result[0]?.choices.evening, "Green tea");
		assert.equal(result[0]?.sugar.evening, false);
		assert.equal(result[0]?.choices.morning, "Black Coffee");
	});
});
