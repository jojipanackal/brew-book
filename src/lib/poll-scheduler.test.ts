import assert from "node:assert/strict";
import { test } from "node:test";
import { startPollScheduler } from "./poll-scheduler";

async function settle() {
	for (let i = 0; i < 10; i++) await Promise.resolve();
}

test("startup and midnight initialize responses even without connected clients", async (t) => {
	t.mock.timers.enable({
		apis: ["Date", "setTimeout"],
		now: new Date("2026-10-21T23:59:59+05:30").getTime(),
	});
	const initialized: string[] = [];
	const published: string[] = [];
	const stop = startPollScheduler({
		companies: async () => ["a"],
		ensure: async (id, date) => {
			initialized.push(`${id}:${date}`);
		},
		publish: (id, date) => {
			published.push(`${id}:${date}`);
		},
		onError: (error) => {
			throw error;
		},
	});
	t.after(stop);
	await settle();
	assert.deepEqual(initialized, ["a:2026-10-21"]);
	t.mock.timers.tick(1_050);
	await settle();
	assert.deepEqual(initialized, ["a:2026-10-21", "a:2026-10-22"]);
	assert.deepEqual(published, initialized);
	// Closing changes only clock state; it must not overwrite finalized votes.
	t.mock.timers.tick(11 * 60 * 60_000);
	await settle();
	assert.equal(initialized.length, 2);
	assert.equal(published.length, 3);
});

test("startup failures retry and stopping cancels the scheduler", async (t) => {
	t.mock.timers.enable({
		apis: ["Date", "setTimeout"],
		now: new Date("2026-10-21T12:00:00+05:30").getTime(),
	});
	let attempts = 0;
	let failures = 0;
	const stop = startPollScheduler({
		companies: async () => {
			attempts++;
			throw new Error("database unavailable");
		},
		ensure: async () => {},
		publish: () => {},
		onError: () => {
			failures++;
		},
	});
	await settle();
	assert.equal(failures, 1);
	t.mock.timers.tick(30_000);
	await settle();
	assert.equal(attempts, 2);
	stop();
	t.mock.timers.tick(60_000);
	assert.equal(attempts, 2);
});

test("initialization that crosses midnight immediately catches up to the new date", async (t) => {
	t.mock.timers.enable({
		apis: ["Date", "setTimeout"],
		now: new Date("2026-10-21T23:59:59+05:30").getTime(),
	});
	const dates: string[] = [];
	const stop = startPollScheduler({
		companies: async () => ["a"],
		ensure: async (_id, date) => {
			dates.push(date);
			if (dates.length === 1) t.mock.timers.tick(2_000);
		},
		publish: () => {},
		onError: (error) => {
			throw error;
		},
	});
	t.after(stop);
	await settle();
	t.mock.timers.tick(50);
	await settle();
	assert.deepEqual(dates, ["2026-10-21", "2026-10-22"]);
});
