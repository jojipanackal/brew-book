import {
	type AttendanceStatus,
	type DrinkChoice,
	drinks,
	type Period,
	type PollSource,
	periods,
	type User,
} from "#/lib/drinks";
import { captureSentryException } from "#/lib/sentry";
import { displayDateFormatter } from "./constants";

export function displayDate(dateKey: string) {
	return displayDateFormatter.format(new Date(`${dateKey}T12:00:00`));
}

export function isGuestUser(user: User) {
	return (
		user.role === "guest" ||
		user.email.startsWith("guest-") ||
		user.email.endsWith("@guest.brewbook.local")
	);
}

export function compactName(user: User) {
	const parts = user.name.trim().split(/\s+/).filter(Boolean);
	if (isGuestUser(user)) return `${parts[0] ?? user.name} (Guest)`;
	if (parts.length <= 2) return parts.join(" ");
	return `${parts[0]} ${parts[parts.length - 1]}`;
}

export function initials(name: string) {
	return name
		.replace(/\s*\([^)]*\)/g, "")
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 2);
}

export function sourceLabel(source: PollSource) {
	return source === "admin"
		? "Admin"
		: source === "manual"
			? "Manual"
			: "Default";
}

export function availabilityLabel(status: AttendanceStatus) {
	return status === "wfh" ? "WFH" : status === "leave" ? "Leave" : "In office";
}

export function isTransientFetchError(reason: unknown) {
	return (
		reason instanceof TypeError &&
		reason.message.toLowerCase().includes("fetch")
	);
}

export function cx(...classes: Array<string | false | null | undefined>) {
	return classes.filter(Boolean).join(" ");
}

export function countChoices(entries: DrinkChoice[]) {
	return periods.reduce(
		(result, period) => {
			result[period] = drinks.reduce<Record<string, number>>(
				(counts, drink) => {
					counts[drink] = entries.filter(
						(entry) => entry[period] === drink,
					).length;
					return counts;
				},
				{},
			);
			return result;
		},
		{} as Record<Period, Record<string, number>>,
	);
}

export function reportSentryError(reason: unknown, fallbackMessage: string) {
	captureSentryException(reason);
	return reason instanceof Error ? reason.message : fallbackMessage;
}

export function authErrorMessage() {
	if (typeof window === "undefined") return null;
	return new URLSearchParams(window.location.search).get("error");
}

export function pickRandom<T>(items: T[]) {
	return items[Math.floor(Math.random() * items.length)];
}
