import { Menu as MenuIcon, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useRef, useState } from "react";
import type { View } from "../types";

export function AppMenu({
	view,
	setView,
	admin,
	guest,
	name,
	onSignOut,
}: {
	view: View;
	setView: (view: View) => void;
	admin: boolean;
	guest: boolean;
	name: string;
	onSignOut: () => void;
}) {
	const [open, setOpen] = useState(false);
	const navigating = useRef(false);
	const items: Array<{ id: View; label: string }> = [
		{ id: "today", label: "Today’s drinks" },
		...(!guest
			? [
					{ id: "profile" as const, label: "Preferences & history" },
					{ id: "stats" as const, label: "Statistics" },
				]
			: []),
		...(admin ? [{ id: "admin" as const, label: "Administration" }] : []),
	];
	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger className="menu-trigger">
				Menu <MenuIcon size={16} aria-hidden="true" />
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Overlay className="menu-overlay" />
				<Dialog.Content
					className="app-menu"
					onCloseAutoFocus={(event) => {
						if (navigating.current) {
							event.preventDefault();
							document.getElementById("main-content")?.focus();
							navigating.current = false;
						}
					}}
				>
					<div className="menu-heading">
						<Dialog.Title className="font-serif text-3xl">
							BrewBook
						</Dialog.Title>
						<Dialog.Close className="menu-close" aria-label="Close menu">
							<X size={20} />
						</Dialog.Close>
					</div>
					<Dialog.Description className="menu-description">
						{name}
						{guest ? " · Guest" : ""}
					</Dialog.Description>
					<nav aria-label="Main navigation">
						{items.map((item) => (
							<button
								type="button"
								key={item.id}
								aria-current={view === item.id ? "page" : undefined}
								onClick={() => {
									navigating.current = true;
									setView(item.id);
									setOpen(false);
								}}
							>
								{item.label}
								<span aria-hidden="true">↗</span>
							</button>
						))}
					</nav>
					<button
						className="menu-signout"
						type="button"
						onClick={() => {
							setOpen(false);
							onSignOut();
						}}
					>
						{guest ? "Leave guest session" : "Sign out"}
					</button>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
