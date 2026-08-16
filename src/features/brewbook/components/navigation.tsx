import {
	BarChart2,
	ChevronRight,
	Coffee,
	ShieldCheck,
	User as UserIcon,
} from "lucide-react";
import type { View } from "../types";
import { cx } from "../utils";
export function Nav({
	view,
	setView,
	admin = false,
	mobile = false,
	onPollClick,
	pianoOn = false,
}: {
	view: View;
	setView: (view: View) => void;
	admin?: boolean;
	mobile?: boolean;
	onPollClick?: () => void;
	pianoOn?: boolean;
}) {
	const items: Array<{
		id: View;
		label: string;
		icon: React.ReactNode;
		iconActive: React.ReactNode;
	}> = [
		{
			id: "today",
			label: "Poll",
			icon: <Coffee size={22} />,
			iconActive: <Coffee size={22} strokeWidth={2.5} />,
		},
		{
			id: "stats",
			label: "Stats",
			icon: <BarChart2 size={22} />,
			iconActive: <BarChart2 size={22} strokeWidth={2.5} />,
		},
		{
			id: "profile",
			label: "Profile",
			icon: <UserIcon size={22} />,
			iconActive: <UserIcon size={22} strokeWidth={2.5} />,
		},
		...(!admin
			? []
			: [
					{
						id: "admin" as View,
						label: "Admin",
						icon: <ShieldCheck size={22} />,
						iconActive: <ShieldCheck size={22} strokeWidth={2.5} />,
					},
				]),
	];

	if (mobile) {
		return (
			<nav className={cx("grid", admin ? "grid-cols-4" : "grid-cols-3")}>
				{items.map((item) => {
					const active = view === item.id;
					return (
						<button
							key={item.id}
							onClick={() =>
								item.id === "today" && onPollClick
									? onPollClick()
									: setView(item.id)
							}
							type="button"
							className="relative flex flex-col items-center gap-0.5 pb-2 pt-3 transition-colors"
						>
							{active && (
								<span className="absolute inset-x-4 top-0 h-[2px] rounded-b-full bg-[var(--c-brand)]" />
							)}
							<span
								className={cx(
									"relative transition-colors",
									active ? "text-[var(--c-brand)]" : "text-[var(--c-text-dim)]",
								)}
							>
								{active ? item.iconActive : item.icon}
								{item.id === "today" && pianoOn && (
									<span className="absolute -top-1 -right-1 size-2 rounded-full bg-green-400 animate-pulse" />
								)}
							</span>
							<span
								className={cx(
									"text-[10px] font-semibold tracking-wide transition-colors",
									active ? "text-[var(--c-brand)]" : "text-[var(--c-text-dim)]",
								)}
							>
								{item.id === "today" && pianoOn ? "🎹" : item.label}
							</span>
						</button>
					);
				})}
			</nav>
		);
	}

	return (
		<nav
			className={cx(
				"grid gap-2 lg:grid-cols-1",
				admin ? "grid-cols-4" : "grid-cols-3",
			)}
		>
			{items.map((item) => (
				<button
					key={item.id}
					onClick={() =>
						item.id === "today" && onPollClick
							? onPollClick()
							: setView(item.id)
					}
					type="button"
					className={cx(
						"flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-semibold transition lg:flex-row lg:justify-start lg:gap-2 lg:px-3 lg:text-sm",
						view === item.id
							? "bg-[var(--c-brand)] text-white"
							: "text-[var(--c-text-muted)] hover:bg-[var(--c-muted)] hover:text-[var(--c-brand)]",
					)}
				>
					{item.icon}
					<span>{item.label}</span>
					{view === item.id && (
						<ChevronRight className="ml-auto hidden lg:block" size={15} />
					)}
				</button>
			))}
		</nav>
	);
}
export function BrandMark({
	className = "size-8",
	iconSize = 17,
	iconColor = "currentColor",
}: {
	className?: string;
	iconSize?: number;
	iconColor?: string;
}) {
	return (
		<div
			className={cx(
				"grid place-items-center rounded-[10px] bg-[var(--c-brand)] text-[var(--c-cream)]",
				className,
			)}
		>
			<Coffee color={iconColor} size={iconSize} strokeWidth={2.2} />
		</div>
	);
}
