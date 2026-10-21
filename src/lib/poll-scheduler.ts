import { getPollClock, nextPollBoundary } from "./poll-clock";

export function startPollScheduler(tasks: {
	companies: () => Promise<string[]>;
	ensure: (companyId: string, date: string) => Promise<void>;
	publish: (companyId: string, date: string) => void;
	onError: (error: unknown) => void;
}) {
	let stopped = false;
	let initializedDate: string | undefined;
	let timer: ReturnType<typeof setTimeout>;
	async function reconcile() {
		let delay: number;
		try {
			const now = new Date();
			const { date } = getPollClock(now);
			const boundary = nextPollBoundary(now);
			for (const id of await tasks.companies()) {
				if (stopped) return;
				if (initializedDate !== date) await tasks.ensure(id, date);
				if (!stopped) tasks.publish(id, date);
			}
			initializedDate = date;
			// A slow database operation may cross midnight/a cutoff. Catch up
			// immediately rather than skipping the boundary until the next one.
			delay = boundary - Date.now() + 50;
		} catch (error) {
			tasks.onError(error);
			delay = 30_000;
		}
		if (!stopped) {
			timer = setTimeout(reconcile, Math.max(50, delay));
			// The HTTP server owns the process lifetime, not the background clock.
			timer.unref?.();
		}
	}
	void reconcile();
	return () => {
		stopped = true;
		clearTimeout(timer);
	};
}
