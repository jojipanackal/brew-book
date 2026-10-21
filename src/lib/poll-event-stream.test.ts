import assert from "node:assert/strict";
import { test } from "node:test";
import { createPollEventStream } from "./poll-event-stream";
import { publishPollChange } from "./poll-events";

const decode = (value?: Uint8Array) => new TextDecoder().decode(value);

test("only authorized companies invalidate a stream; payloads contain no personal data", async (t) => {
	const abort = new AbortController();
	t.after(() => abort.abort());
	const stream = createPollEventStream(
		new Request("http://localhost/api/events", { signal: abort.signal }),
		"a,b",
		async () => "a,b",
	);
	const reader = stream.getReader();
	assert.equal(decode((await reader.read()).value), "retry: 3000\n\n");
	publishPollChange("other-company", "2026-10-21");
	publishPollChange("b", "2026-10-21");
	assert.equal(decode((await reader.read()).value), "data: {}\n\n");
	abort.abort();
	assert.equal((await reader.read()).done, true);
});

test("global admins receive changes from every company and cancellation cleans up", async () => {
	const stream = createPollEventStream(
		new Request("http://localhost/api/events"),
		"*",
		async () => "*",
	);
	const reader = stream.getReader();
	await reader.read();
	publishPollChange("any-company");
	assert.equal(decode((await reader.read()).value), "data: {}\n\n");
	await reader.cancel();
	assert.doesNotThrow(() => publishPollChange("any-company"));
});

test("revoked/expired access closes the stream on revalidation", async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setInterval"], now: 0 });
	const stream = createPollEventStream(
		new Request("http://localhost/api/events"),
		"a",
		async () => null,
	);
	const reader = stream.getReader();
	t.after(() => reader.cancel());
	await reader.read();
	t.mock.timers.tick(60_000);
	await Promise.resolve();
	const messages: string[] = [];
	for (;;) {
		const chunk = await reader.read();
		if (chunk.done) break;
		messages.push(decode(chunk.value));
	}
	assert.ok(messages.every((message) => message === ": heartbeat\n\n"));
});

test("slow readers have a bounded queue and can reconnect for a fresh snapshot", async () => {
	const stream = createPollEventStream(
		new Request("http://localhost/api/events"),
		"a",
		async () => "a",
	);
	for (let i = 0; i < 100; i++) publishPollChange("a");
	const reader = stream.getReader();
	let count = 0;
	while (!(await reader.read()).done) count++;
	assert.equal(count, 32);
});
