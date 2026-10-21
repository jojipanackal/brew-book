import { createFileRoute } from "@tanstack/react-router";
import { and, eq, gt } from "drizzle-orm";
import { db } from "#/db";
import { companyAdmin, user } from "#/db/schema";
import { auth } from "#/lib/auth";
import { createPollEventStream } from "#/lib/poll-event-stream";

async function accessScope(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (session?.user) {
		const [members, memberships] = await Promise.all([
			db
				.select({ companyId: user.companyId, role: user.role })
				.from(user)
				.where(eq(user.id, session.user.id))
				.limit(1),
			db
				.select({ companyId: companyAdmin.companyId })
				.from(companyAdmin)
				.where(eq(companyAdmin.email, session.user.email.trim().toLowerCase())),
		]);
		const member = members[0];
		if (!member) return null;
		if (member.role === "admin") return "*";
		return (
			[
				...new Set(
					[
						member.companyId,
						...memberships.map((item) => item.companyId),
					].filter((id): id is string => Boolean(id)),
				),
			]
				.sort()
				.join(",") || null
		);
	}
	const token = request.headers
		.get("cookie")
		?.match(/(?:^|;\s*)brewbook_guest=([^;]+)/)?.[1];
	if (!token) return null;
	let decoded: string;
	try {
		decoded = decodeURIComponent(token);
	} catch {
		return null;
	}
	const guests = await db
		.select({ companyId: user.companyId })
		.from(user)
		.where(
			and(
				eq(user.guestToken, decoded),
				eq(user.isGuest, true),
				eq(user.guestStatus, "approved"),
				gt(user.guestExpiresAt, new Date()),
			),
		)
		.limit(1);
	return guests[0]?.companyId ?? null;
}

export const Route = createFileRoute("/api/events")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const scope = await accessScope(request);
				if (!scope)
					return Response.json({ error: "Unauthorized" }, { status: 401 });
				const stream = createPollEventStream(request, scope, accessScope);
				return new Response(stream, {
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache, no-transform",
						"X-Accel-Buffering": "no",
					},
				});
			},
		},
	},
});
