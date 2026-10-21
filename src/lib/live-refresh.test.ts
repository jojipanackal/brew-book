import assert from "node:assert/strict";
import { test } from "node:test";
import { createLiveRefresh } from "./live-refresh";

test("bursts coalesce and invalidations during a fetch queue exactly one follow-up", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	let calls = 0;
	let complete = () => {};
	const queue = createLiveRefresh(async () => {
		calls++;
		await new Promise<void>((resolve) => {
			complete = resolve;
		});
	});
	t.after(queue.dispose);
	queue.schedule();
	queue.schedule();
	queue.schedule();
	t.mock.timers.tick(150);
	assert.equal(calls, 1);
	queue.schedule();
	queue.schedule();
	complete();
	await Promise.resolve();
	await Promise.resolve();
	t.mock.timers.tick(150);
	assert.equal(calls, 2);
	complete();
	await Promise.resolve();
	await Promise.resolve();
	t.mock.timers.tick(60_000);
	assert.equal(calls, 2, "healthy idle clients never poll");
});

test("failed fetches retry, while disposal aborts requests and cancels retries", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	let calls = 0;
	let signal: AbortSignal | undefined;
	const queue = createLiveRefresh(async (currentSignal) => {
		signal = currentSignal;
		calls++;
		throw new Error("offline");
	});
	queue.schedule();
	t.mock.timers.tick(150);
	await Promise.resolve();
	t.mock.timers.tick(1_000);
	assert.equal(calls, 2);
	await Promise.resolve();
	queue.dispose();
	assert.equal(signal?.aborted, true);
	t.mock.timers.tick(60_000);
	assert.equal(calls, 2);
});

test("reconnect invalidation takes priority over a pending failure backoff", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	let calls = 0;
	const queue = createLiveRefresh(async () => {
		calls++;
		if (calls === 1) throw new Error("offline");
	});
	t.after(queue.dispose);
	queue.schedule();
	t.mock.timers.tick(150);
	await Promise.resolve();
	queue.schedule();
	t.mock.timers.tick(150);
	assert.equal(calls, 2);
	await Promise.resolve();
	t.mock.timers.tick(60_000);
	assert.equal(calls, 2);
});
