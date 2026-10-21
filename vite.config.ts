import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";

import { loadDotenvx } from "./dotenvx";

const config = defineConfig(({ mode }) => {
	loadDotenvx();
	const env = loadEnv(mode, process.cwd(), "");
	const sentryPlugin =
		env.SENTRY_ORG && env.SENTRY_PROJECT && env.SENTRY_AUTH_TOKEN
			? sentryVitePlugin({
					org: env.SENTRY_ORG,
					project: env.SENTRY_PROJECT,
					authToken: env.SENTRY_AUTH_TOKEN,
					debug: env.SENTRY_DEBUG === "true",
					sourcemaps: {
						filesToDeleteAfterUpload: "dist/assets/**/*.map",
					},
				})
			: undefined;

	return {
		define: {
			"import.meta.env.SENTRY_ENVIRONMENT": JSON.stringify(
				env.SENTRY_ENVIRONMENT ?? mode,
			),
		},
		build: { sourcemap: true },
		resolve: { tsconfigPaths: true },
		plugins: [
			devtools(),
			nitro({
				plugins: ["./src/server/poll-scheduler.ts"],
				rollupConfig: { external: [/^@sentry\//] },
			}),
			tailwindcss(),
			tanstackStart(),
			viteReact(),
			...(sentryPlugin ? [sentryPlugin] : []),
		],
	};
});

export default config;
