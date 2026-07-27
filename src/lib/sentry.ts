import * as Sentry from "@sentry/react";
import { createIsomorphicFn } from "@tanstack/react-start";

let initialized = false;

function getSentryEnvironment() {
	return import.meta.env.SENTRY_ENVIRONMENT ?? import.meta.env.MODE;
}

export const initSentryClient = createIsomorphicFn().client(() => {
	if (initialized || typeof window === "undefined") return;

	const dsn = import.meta.env.VITE_SENTRY_DSN;
	if (!dsn) return;

	initialized = true;
	Sentry.init({
		dsn,
		environment: getSentryEnvironment(),
		enabled: Boolean(dsn),
		sendDefaultPii: false,
	});
});

export const captureSentryException = createIsomorphicFn().client(
	(error: unknown) => {
		if (!initialized) return;
		Sentry.captureException(error);
	},
);

export const syncSentryUser = createIsomorphicFn().client(
	(
		user: { id?: string; name: string; email: string; role?: string } | null,
	) => {
		if (!initialized) return;

		if (!user) {
			Sentry.setUser(null);
			Sentry.setTag("user_role", "anonymous");
			return;
		}

		Sentry.setUser({
			id: user.id,
			username: user.name,
			email: user.email,
		});
		if (user.role) Sentry.setTag("user_role", user.role);
	},
);
