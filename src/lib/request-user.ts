import { eq } from "drizzle-orm";

import { db } from "#/db";
import { user } from "#/db/schema";
import { auth } from "#/lib/auth";

const localUserId = "local-user-admin";
const localCookieName = "brewbook_local_user";

export function isLocalAuthEnabled() {
	if (
		process.env.NODE_ENV === "production" ||
		process.env.LOCAL_AUTH_ENABLED !== "true"
	)
		return false;
	try {
		const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
		return (
			["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname) &&
			decodeURIComponent(databaseUrl.pathname.slice(1)) === "brewbook_local"
		);
	} catch {
		return false;
	}
}

function readCookie(request: Request, name: string) {
	const value = request.headers
		.get("cookie")
		?.split(";")
		.map((part) => part.trim().split("="))
		.find(([key]) => key === name)?.[1];
	return value ? decodeURIComponent(value) : null;
}

export async function getLocalSeedUser() {
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			image: user.image,
		})
		.from(user)
		.where(eq(user.id, localUserId))
		.limit(1);
	return rows[0] ?? null;
}

export async function getRequestUser(request: Request) {
	if (
		isLocalAuthEnabled() &&
		readCookie(request, localCookieName) === localUserId
	)
		return getLocalSeedUser();
	const session = await auth.api.getSession({ headers: request.headers });
	return session?.user ?? null;
}

export function localLoginCookie() {
	return `${localCookieName}=${localUserId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`;
}

export function clearLocalLoginCookie() {
	return `${localCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
