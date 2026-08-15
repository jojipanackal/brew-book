import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

type LocalUser = {
	id: string;
	name: string;
	email: string;
	image: string | null;
};

async function localAuthRequest(method: "GET" | "POST" | "DELETE") {
	const response = await fetch("/api/local-auth", { method });
	if (method === "GET" && response.status === 404) return null;
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as {
			error?: string;
		} | null;
		throw new Error(body?.error ?? "Local login failed");
	}
	if (method === "DELETE") return null;
	return ((await response.json()) as { user: LocalUser }).user;
}

export function getLocalUser() {
	return localAuthRequest("GET");
}

export function loginLocalUser() {
	return localAuthRequest("POST");
}

export function logoutLocalUser() {
	return localAuthRequest("DELETE");
}
