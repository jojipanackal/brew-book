import { useEffect, useState } from "react";
import { getPollClock } from "#/lib/poll-clock";

export function usePollClock() {
	const [clock, setClock] = useState(() => getPollClock());
	useEffect(() => {
		let timer: ReturnType<typeof setTimeout>;
		const update = () => {
			clearTimeout(timer);
			const next = getPollClock();
			setClock((current) =>
				current.date === next.date && current.minutes === next.minutes
					? current
					: next,
			);
			timer = setTimeout(update, 60_000 - (Date.now() % 60_000) + 20);
		};
		update();
		document.addEventListener("visibilitychange", update);
		window.addEventListener("pageshow", update);
		return () => {
			clearTimeout(timer);
			document.removeEventListener("visibilitychange", update);
			window.removeEventListener("pageshow", update);
		};
	}, []);
	return clock;
}
