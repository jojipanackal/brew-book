import assert from "node:assert/strict";
import { test } from "node:test";
import { getPollClock, nextPollBoundary, pollCutoffs } from "./poll-clock";

test("IST rolls over independently of the server timezone", () => {
	assert.deepEqual(getPollClock(new Date("2026-12-31T18:29:59Z")), {
		date: "2026-12-31",
		minutes: 1439,
	});
	assert.deepEqual(getPollClock(new Date("2026-12-31T18:30:00Z")), {
		date: "2027-01-01",
		minutes: 0,
	});
});

test("cutoffs and the next boundary are exact and strictly in the future", () => {
	const before = new Date("2026-10-21T10:59:59+05:30");
	assert.ok(getPollClock(before).minutes < pollCutoffs.morning);
	assert.equal(
		nextPollBoundary(before),
		Date.parse("2026-10-21T11:00:00+05:30"),
	);
	assert.equal(
		getPollClock(new Date("2026-10-21T11:00:00+05:30")).minutes,
		pollCutoffs.morning,
	);
	assert.equal(
		nextPollBoundary(new Date("2026-10-21T11:00:00+05:30")),
		Date.parse("2026-10-21T15:15:00+05:30"),
	);
	assert.equal(
		nextPollBoundary(new Date("2026-10-21T15:15:00+05:30")),
		Date.parse("2026-10-22T00:00:00+05:30"),
	);
});
