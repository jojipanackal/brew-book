import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Scripts,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "MyBev",
			},
			{
				name: "description",
				content:
					"A shared office drink board for faster, calmer tea and coffee rounds.",
			},
			{
				name: "theme-color",
				content: "#493225",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "icon",
				href: "/favicon.svg",
				type: "image/svg+xml",
			},
		],
	}),
	notFoundComponent: NotFoundPage,
	shellComponent: RootDocument,
});

function NotFoundPage() {
	return (
		<main className="grid min-h-svh place-items-center bg-[#f6f5f1] px-5 text-[#33271f]">
			<section className="w-full max-w-sm rounded-3xl bg-[#fffdf9] p-8 text-center shadow-[0_20px_60px_rgba(77,57,38,0.1)]">
				<div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#5a3c26] text-[#fff9ef]">
					<span className="font-serif text-2xl">404</span>
				</div>
				<h1 className="mt-6 font-serif text-3xl">Page not found</h1>
				<p className="mt-2 text-sm leading-6 text-[#887f74]">
					This MyBev page does not exist.
				</p>
				<Link
					className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-[#5a3c26] px-4 text-sm font-semibold text-white transition hover:bg-[#68452e]"
					to="/"
				>
					Back to MyBev
				</Link>
			</section>
		</main>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
