// Coalesce invalidations, serialize snapshots, and retry failed fetches without
// introducing periodic requests when the connection is healthy and idle.
export function createLiveRefresh(
	refresh: (signal: AbortSignal) => Promise<void>,
) {
	const controller = new AbortController();
	let running = false;
	let dirty = false;
	let retrying = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let retryDelay = 1_000;
	const run = async () => {
		timer = undefined;
		retrying = false;
		if (controller.signal.aborted) return;
		running = true;
		dirty = false;
		let failed = false;
		try {
			await refresh(controller.signal);
			retryDelay = 1_000;
		} catch {
			failed = true;
		} finally {
			running = false;
			if (!controller.signal.aborted) {
				if (dirty) schedule();
				else if (failed) {
					retrying = true;
					timer = setTimeout(() => {
						void run();
					}, retryDelay);
					retryDelay = Math.min(retryDelay * 2, 30_000);
				}
			}
		}
	};
	const schedule = () => {
		if (controller.signal.aborted) return;
		if (running) {
			dirty = true;
			return;
		}
		// A reconnect/new change should not wait behind a long failure backoff.
		if (retrying) {
			clearTimeout(timer);
			timer = undefined;
			retrying = false;
		}
		if (!timer)
			timer = setTimeout(() => {
				void run();
			}, 150);
	};
	return {
		schedule,
		dispose() {
			controller.abort();
			clearTimeout(timer);
		},
	};
}
