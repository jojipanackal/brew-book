import { useEffect, useState } from "react";

export function useTheme() {
	const [dark, setDark] = useState(() => {
		if (typeof window === "undefined") return false;
		const saved = localStorage.getItem("theme");
		if (saved) return saved === "dark";
		return window.matchMedia("(prefers-color-scheme: dark)").matches;
	});

	useEffect(() => {
		document.documentElement.classList.toggle("dark", dark);
		localStorage.setItem("theme", dark ? "dark" : "light");
	}, [dark]);

	return { dark, toggle: () => setDark((current) => !current) };
}
