import { useEffect, useRef } from "react";
import { createLiveRefresh } from "#/lib/live-refresh";

// One stream per mounted app. Reconnects and visibility recovery always fetch
// a fresh snapshot, so event persistence/replay is unnecessary.
export function usePollEvents(
	identity: string | null,
	refresh: (signal: AbortSignal) => Promise<void>,
) {
	const refreshRef = useRef(refresh);
	useEffect(() => {
		refreshRef.current = refresh;
	});
	useEffect(() => {
		if (!identity) return;
		const queue = createLiveRefresh((signal) => refreshRef.current(signal));
		const { schedule } = queue;
		const events = new EventSource("/api/events");
		events.onopen = schedule;
		events.onmessage = schedule;
		schedule();
		const onVisible = () => {
			if (!document.hidden) schedule();
		};
		document.addEventListener("visibilitychange", onVisible);
		window.addEventListener("online", schedule);
		return () => {
			queue.dispose();
			events.close();
			document.removeEventListener("visibilitychange", onVisible);
			window.removeEventListener("online", schedule);
		};
	}, [identity]);
}
