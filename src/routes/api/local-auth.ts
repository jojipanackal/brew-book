import { createFileRoute } from "@tanstack/react-router";

import {
	clearLocalLoginCookie,
	getLocalSeedUser,
	getRequestUser,
	isLocalAuthEnabled,
	localLoginCookie,
} from "#/lib/request-user";

function unavailable() {
	return Response.json({ error: "Not found" }, { status: 404 });
}

async function sessionResponse(
	request: Request,
	cookie?: string,
	seededUser = false,
) {
	const currentUser = seededUser
		? await getLocalSeedUser()
		: await getRequestUser(request);
	if (!currentUser)
		return Response.json(
			{ error: "Local user is not seeded" },
			{ status: 404 },
		);
	return Response.json(
		{ user: currentUser },
		cookie ? { headers: { "Set-Cookie": cookie } } : undefined,
	);
}

export const Route = createFileRoute("/api/local-auth")({
	server: {
		handlers: {
			GET: ({ request }) =>
				isLocalAuthEnabled() ? sessionResponse(request) : unavailable(),
			POST: ({ request }) =>
				isLocalAuthEnabled()
					? sessionResponse(request, localLoginCookie(), true)
					: unavailable(),
			DELETE: () =>
				isLocalAuthEnabled()
					? Response.json(
							{ ok: true },
							{ headers: { "Set-Cookie": clearLocalLoginCookie() } },
						)
					: unavailable(),
		},
	},
});
