import { subscribeToPolls } from "./poll-events";

export function createPollEventStream(
	request: Request,
	scope: string,
	getScope: (request: Request) => Promise<string | null>,
) {
	const companies = new Set(scope.split(","));
	const encoder = new TextEncoder();
	let cleanup = () => {};
	return new ReadableStream<Uint8Array>(
		{
			start(controller) {
				let closed = false;
				let checking = false;
				let lastCheck = Date.now();
				let unsubscribe = () => {};
				let heartbeat: ReturnType<typeof setInterval>;
				cleanup = () => {
					if (closed) return;
					closed = true;
					unsubscribe();
					clearInterval(heartbeat);
					request.signal.removeEventListener("abort", cleanup);
					try {
						controller.close();
					} catch {
						/* Already cancelled by the reader. */
					}
				};
				const send = (message: string) => {
					if (closed) return;
					// Bound memory for slow readers. Reconnect refetches recover missed events.
					if ((controller.desiredSize ?? 0) <= 0) {
						cleanup();
						return;
					}
					controller.enqueue(encoder.encode(message));
				};
				unsubscribe = subscribeToPolls((event) => {
					if (scope === "*" || companies.has(event.companyId))
						send("data: {}\n\n");
				});
				heartbeat = setInterval(async () => {
					if (checking || closed) return;
					checking = true;
					try {
						if (Date.now() - lastCheck >= 60_000) {
							if ((await getScope(request)) !== scope) {
								cleanup();
								return;
							}
							lastCheck = Date.now();
						}
						send(": heartbeat\n\n");
					} catch {
						cleanup();
					} finally {
						checking = false;
					}
				}, 20_000);
				request.signal.addEventListener("abort", cleanup, { once: true });
				if (request.signal.aborted) cleanup();
				else send("retry: 3000\n\n");
			},
			cancel() {
				cleanup();
			},
		},
		{ highWaterMark: 32 },
	);
}
