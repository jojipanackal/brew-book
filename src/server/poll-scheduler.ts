import { definePlugin } from "nitro";
import { db } from "../db";
import { company } from "../db/schema";
import { publishPollChange } from "../lib/poll-events";
import { ensureTodayResponses } from "../lib/poll-responses";
import { startPollScheduler } from "../lib/poll-scheduler";

export default definePlugin((app) => {
	const stop = startPollScheduler({
		companies: async () =>
			(await db.select({ id: company.id }).from(company)).map((row) => row.id),
		ensure: ensureTodayResponses,
		publish: publishPollChange,
		onError: (error) =>
			console.error("Poll reconciliation failed; retrying in 30s", error),
	});
	process.once("SIGTERM", stop);
	process.once("SIGINT", stop);
	app.hooks.hook("close", () => {
		stop();
		process.removeListener("SIGTERM", stop);
		process.removeListener("SIGINT", stop);
	});
});
