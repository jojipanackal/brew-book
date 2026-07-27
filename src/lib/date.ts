export const APP_TIME_ZONE = "Asia/Kolkata";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: APP_TIME_ZONE,
});

const displayDateFormatter = new Intl.DateTimeFormat("en-US", {
	weekday: "short",
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: APP_TIME_ZONE,
});

export function getDateKey(date = new Date()) {
	return dateKeyFormatter.format(date);
}

export function shiftDateKey(dateKey: string, offset: number) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
	if (!match) throw new Error(`Invalid date key: ${dateKey}`);

	const [, year, month, day] = match;
	const shifted = new Date(
		Date.UTC(Number(year), Number(month) - 1, Number(day) + offset),
	);
	return shifted.toISOString().slice(0, 10);
}

export function displayDate(dateKey: string) {
	return displayDateFormatter.format(new Date(`${dateKey}T00:00:00.000Z`));
}
