export const drinks = [
	"Tea",
	"Coffee",
	"Green tea",
	"Milk",
	"Black Coffee",
	"Black Tea",
	"No drink",
] as const;
export const periods = ["morning", "evening"] as const;

export type Drink = (typeof drinks)[number];
export type Period = (typeof periods)[number];
export type Company = string;
export type CompanyRecord = {
	id: string;
	name: string;
	emailEnding1: string;
	emailEnding2: string | null;
};
export type PollSource = "default" | "manual" | "admin";
export type DrinkChoice = Record<Period, Drink>;
export type SugarChoice = Record<Period, boolean>;
export type User = {
	id?: string;
	name: string;
	email: string;
	image?: string | null;
	role?: "user" | "admin" | "guest";
};
export type PollRecord = {
	user: User;
	choices: DrinkChoice;
	sugar: SugarChoice;
	sources: Record<Period, PollSource>;
};
export type DrinkDay = {
	date: string;
	defaults: DrinkChoice;
	sugarDefaults: SugarChoice;
	responses: PollRecord[];
};
export type Profile = {
	company: Company | null;
	requiresCompany: boolean;
	needsOnboarding: boolean;
	defaults: DrinkChoice;
	sugarDefaults: SugarChoice;
	role: "user" | "admin" | "guest";
	accessDenied: boolean;
};
export type GuestSession = {
	user: User;
	date: string;
	status: "pending" | "approved" | "rejected";
	defaults: DrinkChoice;
	sugarDefaults: SugarChoice;
	responses: PollRecord[];
};
export type AdminDashboard = {
	date: string;
	pendingGuests: Array<{
		id: string;
		name: string;
		company: string | null;
		requestedAt: string | null;
	}>;
	responses: PollRecord[];
};

async function request<T>(
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<T> {
	const response = await fetch(input, {
		...init,
		headers: { "Content-Type": "application/json", ...init?.headers },
	});
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as {
			error?: string;
		} | null;
		throw new Error(
			body?.error || `Request failed with status ${response.status}`,
		);
	}
	return response.json() as Promise<T>;
}

export function getDrinkDay(date: string) {
	return request<DrinkDay>(`/api/drinks?date=${encodeURIComponent(date)}`);
}

export function saveResponse(input: {
	date: string;
	period: Period;
	drink: Drink;
	sugar: boolean;
}) {
	return request<DrinkDay>("/api/drinks", {
		method: "PUT",
		body: JSON.stringify({ type: "response", ...input }),
	});
}

export function saveDefault(input: {
	period: Period;
	drink: Drink;
	sugar: boolean;
}) {
	return request<{ defaults: DrinkChoice; sugarDefaults: SugarChoice }>(
		"/api/drinks",
		{
			method: "PUT",
			body: JSON.stringify({ type: "default", ...input }),
		},
	);
}

export function getProfile() {
	return request<Profile>("/api/profile");
}

export function getCompanies() {
	return request<CompanyRecord[]>("/api/companies");
}

export function completeOnboarding(input: {
	company: Company;
	defaults: DrinkChoice;
	sugarDefaults: SugarChoice;
}) {
	return request<Profile>("/api/profile", {
		method: "PUT",
		body: JSON.stringify(input),
	});
}

export function getGuestSession() {
	return request<GuestSession>("/api/guest");
}

export function createGuest(input: { name: string; company: Company }) {
	return request<GuestSession>("/api/guest", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export function leaveGuest() {
	return request<{ ok: true }>("/api/guest", { method: "DELETE" });
}

export function getAdminDashboard() {
	return request<AdminDashboard>("/api/admin");
}

export function updateGuestRequest(input: {
	type: "approve" | "reject" | "removeGuest";
	userId: string;
}) {
	return request<{ ok: true }>("/api/admin", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export function updateUserResponse(input: {
	userId: string;
	period: Period;
	drink: Drink;
	sugar: boolean;
}) {
	return request<{ ok: true }>("/api/admin", {
		method: "POST",
		body: JSON.stringify({ type: "response", ...input }),
	});
}
