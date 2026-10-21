// IST has no daylight-saving transitions. Keep server and browser cutoffs identical.
const offset = 330 * 60_000;
export const pollCutoffs = { morning: 11 * 60, evening: 15 * 60 + 15 };

export function getPollClock(now = new Date()) {
	const local = new Date(now.getTime() + offset);
	return {
		date: local.toISOString().slice(0, 10),
		minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
	};
}

export function nextPollBoundary(now = new Date()) {
	const { date } = getPollClock(now);
	const midnight = Date.parse(`${date}T00:00:00+05:30`);
	return [pollCutoffs.morning, pollCutoffs.evening, 24 * 60]
		.map((minutes) => midnight + minutes * 60_000)
		.find((time) => time > now.getTime()) as number;
}
