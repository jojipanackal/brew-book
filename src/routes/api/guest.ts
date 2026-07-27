import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";

import { db } from "#/db";
import { company, user } from "#/db/schema";
import { getDateKey } from "#/lib/date";
import type { Company, Drink } from "#/lib/drinks";
import { readDay } from "./drinks";

function json(data: unknown, init?: ResponseInit) {
	return Response.json(data, init);
}

function isCompany(value: unknown): value is Company {
	return typeof value === "string" && value.trim().length > 0;
}

function guestCookie(token: string, maxAge: number) {
	return `brewbook_guest=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

async function getGuest(request: Request) {
	const token = request.headers
		.get("cookie")
		?.match(/(?:^|;\s*)brewbook_guest=([^;]+)/)?.[1];
	if (!token) return null;
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			image: user.image,
			status: user.guestStatus,
		})
		.from(user)
		.where(
			and(
				eq(user.guestToken, decodeURIComponent(token)),
				eq(user.isGuest, true),
			),
		)
		.limit(1);
	return rows[0] ?? null;
}

async function guestResponse(guest: {
	id: string;
	name: string;
	email: string;
	image: string | null;
	status: "pending" | "approved" | "rejected" | null;
}) {
	const day =
		guest.status === "approved"
			? await readDay(guest.id, getDateKey())
			: {
					defaults: {
						morning: "No drink" as Drink,
						evening: "No drink" as Drink,
					},
					sugarDefaults: { morning: true, evening: true },
					responses: [],
				};
	return {
		user: {
			id: guest.id,
			name: guest.name,
			email: guest.email,
			image: guest.image,
			role: "guest" as const,
		},
		status:
			guest.status === "approved"
				? ("approved" as const)
				: guest.status === "rejected"
					? ("rejected" as const)
					: ("pending" as const),
		date: getDateKey(),
		...day,
	};
}

export const Route = createFileRoute("/api/guest")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const guest = await getGuest(request);
				if (!guest)
					return json(
						{ error: "No active guest session" },
						{ status: 401, headers: { "Set-Cookie": guestCookie("", 0) } },
					);
				return json(await guestResponse(guest));
			},
			POST: async ({ request }) => {
				const body = (await request.json()) as {
					name?: unknown;
					company?: unknown;
				};
				const name = typeof body.name === "string" ? body.name.trim() : "";
				if (name.length < 2 || name.length > 80)
					return json({ error: "Enter your name" }, { status: 400 });
				if (!isCompany(body.company))
					return json({ error: "Choose a company" }, { status: 400 });
				const companyRow = await db
					.select({ id: company.id, name: company.name })
					.from(company)
					.where(eq(company.name, body.company))
					.limit(1);
				if (!companyRow[0])
					return json({ error: "Choose a valid company" }, { status: 400 });

				const id = crypto.randomUUID();
				const token = crypto.randomUUID();
				const guest = {
					id,
					name,
					email: `guest-${id}@guest.brewbook.local`,
					image: null,
				};
				await db.insert(user).values({
					id,
					name,
					email: guest.email,
					company: companyRow[0].name,
					companyId: companyRow[0].id,
					role: "guest",
					isGuest: true,
					guestToken: token,
					guestStatus: "pending",
					guestRequestedAt: new Date(),
				});
				return json(await guestResponse({ ...guest, status: "pending" }), {
					headers: { "Set-Cookie": guestCookie(token, 24 * 60 * 60) },
				});
			},
			DELETE: async ({ request }) => {
				const guest = await getGuest(request);
				if (guest) await db.delete(user).where(eq(user.id, guest.id));
				return json(
					{ ok: true },
					{ headers: { "Set-Cookie": guestCookie("", 0) } },
				);
			},
		},
	},
});
