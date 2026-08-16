import { useEffect, useState } from "react";

export function useGyroscope() {
	const [tilt, setTilt] = useState({ gamma: 0, beta: 0 });
	const [permission, setPermission] = useState<
		"unknown" | "granted" | "denied"
	>("unknown");

	useEffect(() => {
		const needsPermission =
			typeof (
				DeviceOrientationEvent as unknown as {
					requestPermission?: () => Promise<string>;
				}
			).requestPermission === "function";
		if (!needsPermission) setPermission("granted");
	}, []);

	useEffect(() => {
		if (permission !== "granted") return;
		function handler(event: DeviceOrientationEvent) {
			setTilt({
				gamma: Math.max(-45, Math.min(45, event.gamma ?? 0)),
				beta: Math.max(-90, Math.min(90, event.beta ?? 0)),
			});
		}
		window.addEventListener("deviceorientation", handler, true);
		return () => window.removeEventListener("deviceorientation", handler, true);
	}, [permission]);

	async function requestPermission() {
		const api = (
			DeviceOrientationEvent as unknown as {
				requestPermission?: () => Promise<string>;
			}
		).requestPermission;
		if (api) {
			const result = await api();
			setPermission(result === "granted" ? "granted" : "denied");
			return;
		}
		setPermission("granted");
	}

	return { tilt, permission, requestPermission };
}
