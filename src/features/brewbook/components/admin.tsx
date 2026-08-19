import { ChevronRight, X as XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
	type AdminDashboard,
	type AttendanceStatus,
	type Cook,
	calculatePollResults,
	createCook,
	type Drink,
	drinks,
	formatPollResultsMessage,
	generateWhatsAppUrl,
	getCooks,
	type Period,
	type PollRecord,
	type PollResults,
	type PollSource,
	periods,
	updateCook,
	updateGuestRequest,
	updateUserAvailability,
	updateUserResponse,
} from "#/lib/drinks";
import { brewingMessages } from "../constants";
import {
	compactName,
	cx,
	isGuestUser,
	pickRandom,
	sourceLabel,
} from "../utils";
import { AuthLoading } from "./auth";
import { MetaTag, PageHeader, SugarToggle } from "./common";

function AdminResultsView({
	data,
	cooks,
	onSendToCook,
}: {
	data: AdminDashboard;
	cooks: Cook[];
	onSendToCook: (period: Period, results: PollResults) => void;
}) {
	return (
		<div className="grid gap-4">
			{periods.map((period) => {
				const results = calculatePollResults(data.responses, period);
				const hasDrinks = Object.values(results.results).some(
					(count) => count > 0,
				);

				return (
					<section
						key={period}
						className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] p-4"
					>
						<div className="flex items-center justify-between gap-3">
							<div>
								<h2 className="text-sm font-semibold text-[var(--c-text-dark)]">
									{period === "morning" ? "Morning" : "Evening"} Results
								</h2>
								<p className="mt-1 text-xs text-[var(--c-text-muted)]">
									{results.total === 0
										? "No responses yet"
										: `Total: ${results.total}`}
								</p>
							</div>
							{hasDrinks && cooks.length > 0 && (
								<button
									onClick={() => onSendToCook(period, results)}
									type="button"
									className="shrink-0 rounded-lg bg-[var(--c-brand)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
								>
									Send to Cook
								</button>
							)}
						</div>

						{hasDrinks ? (
							<div className="mt-3 space-y-2">
								{Object.entries(results.results)
									.filter(([drink]) => drink !== "No drink")
									.map(
										([drink, count]) =>
											count > 0 && (
												<div
													key={drink}
													className="flex items-center justify-between rounded-lg bg-[var(--c-row)] px-3 py-2"
												>
													<span className="text-sm text-[var(--c-text-mid)]">
														{drink}
													</span>
													<span className="font-semibold text-[var(--c-brand)]">
														{count}
													</span>
												</div>
											),
									)}
							</div>
						) : (
							<p className="mt-3 text-xs text-[var(--c-text-muted)]">
								No responses have been recorded for this poll.
							</p>
						)}
					</section>
				);
			})}
		</div>
	);
}

function AdminCooksView({
	cooks,
	loading,
	editingCook,
	showAddCook,
	onRefresh,
	onEdit,
	onShowAdd,
	onCloseAdd,
	onCloseEdit,
}: {
	cooks: Cook[];
	loading: boolean;
	editingCook: Cook | null;
	showAddCook: boolean;
	onRefresh: () => void;
	onEdit: (cook: Cook) => void;
	onShowAdd: () => void;
	onCloseAdd: () => void;
	onCloseEdit: () => void;
}) {
	return (
		<div className="grid gap-4">
			<section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] p-4">
				<div className="flex items-center justify-between gap-3">
					<h2 className="text-sm font-semibold text-[var(--c-text-dark)]">
						Cooks
					</h2>
					<button
						onClick={onShowAdd}
						type="button"
						className="rounded-lg bg-[var(--c-brand)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
					>
						+ Add Cook
					</button>
				</div>

				{loading ? (
					<div className="mt-4 text-center text-xs text-[var(--c-text-muted)]">
						Loading cooks...
					</div>
				) : cooks.length === 0 ? (
					<div className="mt-4 text-center text-xs text-[var(--c-text-muted)]">
						No cooks added yet
					</div>
				) : (
					<div className="mt-3 space-y-2">
						{cooks.map((cook) => (
							<div
								key={cook.id}
								className={cx(
									"rounded-lg px-3 py-3",
									cook.isActive
										? "bg-[var(--c-row)]"
										: "bg-[var(--c-muted)] opacity-60",
								)}
							>
								<div className="flex items-center justify-between gap-3">
									<div className="min-w-0">
										<p className="truncate text-sm font-semibold">
											{cook.name}
										</p>
										<p className="mt-1 truncate text-xs text-[var(--c-text-muted)]">
											+{cook.phoneNumber}
										</p>
									</div>
									<div className="flex shrink-0 gap-2">
										<button
											onClick={() => onEdit(cook)}
											type="button"
											className="rounded-lg border border-[var(--c-border)] px-3 py-2 text-xs font-semibold text-[var(--c-text-mid)] hover:bg-[var(--c-card)]"
										>
											Edit
										</button>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</section>

			{showAddCook && (
				<AddCookModal onClose={onCloseAdd} onRefresh={onRefresh} />
			)}

			{editingCook && (
				<EditCookModal
					cook={editingCook}
					onClose={onCloseEdit}
					onRefresh={onRefresh}
				/>
			)}
		</div>
	);
}

function AddCookModal({
	onClose,
	onRefresh,
}: {
	onClose: () => void;
	onRefresh: () => void;
}) {
	const [name, setName] = useState("");
	const [phone, setPhone] = useState("");
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	const handleSubmit = () => {
		setError("");
		if (!name.trim()) {
			setError("Name is required");
			return;
		}
		if (!phone.trim()) {
			setError("Phone number is required");
			return;
		}

		setSaving(true);
		void createCook({ name: name.trim(), phoneNumber: phone.trim() })
			.then(() => {
				onRefresh();
				onClose();
			})
			.catch((err) => {
				setError(err instanceof Error ? err.message : "Failed to create cook");
				setSaving(false);
			});
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="w-full max-w-md rounded-2xl bg-[var(--c-card)] p-6">
				<h2 className="text-lg font-semibold text-[var(--c-text-dark)]">
					Add Cook
				</h2>

				<div className="mt-4 space-y-3">
					<div>
						<label
							htmlFor="add-cook-name"
							className="block text-xs font-semibold text-[var(--c-text-mid)]"
						>
							Name
						</label>
						<input
							id="add-cook-name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Cook name"
							className="mt-1 h-10 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 text-sm text-[var(--c-text-dark)]"
						/>
					</div>

					<div>
						<label
							htmlFor="add-cook-phone"
							className="block text-xs font-semibold text-[var(--c-text-mid)]"
						>
							Phone Number
						</label>
						<input
							id="add-cook-phone"
							type="text"
							value={phone}
							onChange={(e) => setPhone(e.target.value)}
							placeholder="+91 98765 43210"
							className="mt-1 h-10 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 text-sm text-[var(--c-text-dark)]"
						/>
						<p className="mt-1 text-xs text-[var(--c-text-muted)]">
							Include country code (e.g., +91 for India)
						</p>
					</div>

					{error && (
						<div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
							{error}
						</div>
					)}
				</div>

				<div className="mt-6 flex gap-3">
					<button
						onClick={onClose}
						type="button"
						disabled={saving}
						className="flex-1 rounded-lg border border-[var(--c-border)] px-3 py-2 text-sm font-semibold text-[var(--c-text-mid)] hover:bg-[var(--c-muted)]"
					>
						Cancel
					</button>
					<button
						onClick={handleSubmit}
						type="button"
						disabled={saving}
						className="flex-1 rounded-lg bg-[var(--c-brand)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
					>
						{saving ? "Saving..." : "Add"}
					</button>
				</div>
			</div>
		</div>
	);
}

function EditCookModal({
	cook,
	onClose,
	onRefresh,
}: {
	cook: Cook;
	onClose: () => void;
	onRefresh: () => void;
}) {
	const [name, setName] = useState(cook.name);
	const [phone, setPhone] = useState(cook.phoneNumber);
	const [isActive, setIsActive] = useState(cook.isActive);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	const handleSubmit = () => {
		setError("");
		if (!name.trim()) {
			setError("Name is required");
			return;
		}
		if (!phone.trim()) {
			setError("Phone number is required");
			return;
		}

		const updates: {
			id: string;
			name?: string;
			phoneNumber?: string;
			isActive?: boolean;
		} = { id: cook.id };

		if (name !== cook.name) updates.name = name.trim();
		if (phone !== cook.phoneNumber) updates.phoneNumber = phone.trim();
		if (isActive !== cook.isActive) updates.isActive = isActive;

		setSaving(true);
		void updateCook(updates)
			.then(() => {
				onRefresh();
				onClose();
			})
			.catch((err) => {
				setError(err instanceof Error ? err.message : "Failed to update cook");
				setSaving(false);
			});
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="w-full max-w-md rounded-2xl bg-[var(--c-card)] p-6">
				<h2 className="text-lg font-semibold text-[var(--c-text-dark)]">
					Edit Cook
				</h2>

				<div className="mt-4 space-y-3">
					<div>
						<label
							htmlFor="edit-cook-name"
							className="block text-xs font-semibold text-[var(--c-text-mid)]"
						>
							Name
						</label>
						<input
							id="edit-cook-name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="mt-1 h-10 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 text-sm text-[var(--c-text-dark)]"
						/>
					</div>

					<div>
						<label
							htmlFor="edit-cook-phone"
							className="block text-xs font-semibold text-[var(--c-text-mid)]"
						>
							Phone Number
						</label>
						<input
							id="edit-cook-phone"
							type="text"
							value={phone}
							onChange={(e) => setPhone(e.target.value)}
							className="mt-1 h-10 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 text-sm text-[var(--c-text-dark)]"
						/>
					</div>

					<div className="flex items-center gap-3 rounded-lg bg-[var(--c-row)] p-3">
						<label className="flex flex-1 cursor-pointer items-center gap-3">
							<input
								type="checkbox"
								checked={isActive}
								onChange={(e) => setIsActive(e.target.checked)}
								className="h-4 w-4"
							/>
							<span className="text-sm font-semibold text-[var(--c-text-dark)]">
								Active
							</span>
						</label>
					</div>

					{error && (
						<div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
							{error}
						</div>
					)}
				</div>

				<div className="mt-6 flex gap-3">
					<button
						onClick={onClose}
						type="button"
						disabled={saving}
						className="flex-1 rounded-lg border border-[var(--c-border)] px-3 py-2 text-sm font-semibold text-[var(--c-text-mid)] hover:bg-[var(--c-muted)]"
					>
						Cancel
					</button>
					<button
						onClick={handleSubmit}
						type="button"
						disabled={saving}
						className="flex-1 rounded-lg bg-[var(--c-brand)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
					>
						{saving ? "Saving..." : "Save"}
					</button>
				</div>
			</div>
		</div>
	);
}

function SendToCookModal({
	results,
	period,
	selectedCook,
	cooks,
	onSelectCook,
	onClose,
}: {
	results: PollResults;
	period: Period;
	selectedCook: Cook | null;
	cooks: Cook[];
	onSelectCook: (cook: Cook) => void;
	onClose: () => void;
}) {
	const [step, setStep] = useState<"select" | "preview">(
		selectedCook ? "preview" : "select",
	);

	const message = selectedCook
		? formatPollResultsMessage(results, results.date)
		: "";
	const whatsappUrl = selectedCook
		? generateWhatsAppUrl(selectedCook.phoneNumber, message)
		: "";

	if (step === "select" || !selectedCook) {
		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
				<div className="w-full max-w-md rounded-2xl bg-[var(--c-card)] p-6">
					<h2 className="text-lg font-semibold text-[var(--c-text-dark)]">
						Send Poll Result
					</h2>
					<p className="mt-1 text-sm text-[var(--c-text-muted)]">
						{period === "morning" ? "Morning" : "Evening"} Results
					</p>

					{cooks.length === 0 ? (
						<div className="mt-4 rounded-lg bg-amber-50 p-3">
							<p className="text-sm text-amber-900">
								No cooks have been added yet.
							</p>
							<p className="mt-2 text-xs text-amber-800">
								Add a cook from Admin → Cooks to send poll results.
							</p>
						</div>
					) : (
						<div className="mt-4 space-y-2">
							{cooks.map((cook) => (
								<button
									key={cook.id}
									onClick={() => {
										onSelectCook(cook);
										setStep("preview");
									}}
									type="button"
									className="w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-row)] px-3 py-3 text-left transition hover:bg-[var(--c-card)]"
								>
									<p className="font-semibold text-[var(--c-text-dark)]">
										{cook.name}
									</p>
									<p className="mt-1 text-xs text-[var(--c-text-muted)]">
										+{cook.phoneNumber}
									</p>
								</button>
							))}
						</div>
					)}

					<div className="mt-6 flex gap-3">
						<button
							onClick={onClose}
							type="button"
							className="flex-1 rounded-lg border border-[var(--c-border)] px-3 py-2 text-sm font-semibold text-[var(--c-text-mid)] hover:bg-[var(--c-muted)]"
						>
							Close
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="w-full max-w-md rounded-2xl bg-[var(--c-card)] p-6">
				<h2 className="text-lg font-semibold text-[var(--c-text-dark)]">
					Send to Cook
				</h2>

				<div className="mt-4 space-y-4">
					<div>
						<p className="text-xs font-semibold text-[var(--c-text-mid)]">
							Cook
						</p>
						<div className="mt-2 rounded-lg bg-[var(--c-row)] p-3">
							<p className="font-semibold text-[var(--c-text-dark)]">
								{selectedCook.name}
							</p>
							<p className="mt-1 text-sm text-[var(--c-text-muted)]">
								+{selectedCook.phoneNumber}
							</p>
						</div>
					</div>

					<div>
						<p className="text-xs font-semibold text-[var(--c-text-mid)]">
							Message
						</p>
						<div className="mt-2 whitespace-pre-wrap rounded-lg bg-[var(--c-row)] p-3 font-mono text-xs text-[var(--c-text-dark)]">
							{message}
						</div>
					</div>
				</div>

				<div className="mt-6 flex gap-3">
					<button
						onClick={() => setStep("select")}
						type="button"
						className="flex-1 rounded-lg border border-[var(--c-border)] px-3 py-2 text-sm font-semibold text-[var(--c-text-mid)] hover:bg-[var(--c-muted)]"
					>
						Back
					</button>
					<a
						href={whatsappUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="flex-1 rounded-lg bg-green-500 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-green-600 no-underline"
					>
						Open WhatsApp
					</a>
				</div>
			</div>
		</div>
	);
}

export function AdminView({
	data,
	onRefresh,
}: {
	data: AdminDashboard | null;
	onRefresh: () => void;
}) {
	const [openUserId, setOpenUserId] = useState<string | null>(null);
	const [userSearch, setUserSearch] = useState("");
	const [adminTab, setAdminTab] = useState<"today" | "results" | "cooks">(
		"today",
	);
	const [cooks, setCooks] = useState<Cook[]>([]);
	const [loadingCooks, setLoadingCooks] = useState(false);
	const [editingCook, setEditingCook] = useState<Cook | null>(null);
	const [showAddCook, setShowAddCook] = useState(false);
	const [sendToCookData, setSendToCookData] = useState<{
		period: Period;
		selectedCook: Cook | null;
		results: PollResults | null;
	} | null>(null);
	const filteredUsers =
		data?.responses.filter((poll) => {
			const query = userSearch.trim().toLowerCase();
			return (
				!query ||
				`${poll.user.name} ${poll.user.email}`.toLowerCase().includes(query)
			);
		}) ?? [];

	useEffect(() => {
		setLoadingCooks(true);
		void getCooks()
			.then((res) => setCooks(res.cooks))
			.catch(() => setCooks([]))
			.finally(() => setLoadingCooks(false));
	}, []);

	if (!data) return <AuthLoading message={pickRandom(brewingMessages)} />;
	return (
		<div className="grid gap-5">
			<PageHeader
				eyebrow="Admin"
				title="Manage today"
				action={
					data.pendingGuests.length
						? `${data.pendingGuests.length} pending`
						: "No pending guests"
				}
			/>

			{/* Admin Tabs */}
			<div className="flex gap-2 rounded-xl bg-[var(--c-card)] p-1">
				{[
					{ id: "today", label: "Users" },
					{ id: "results", label: "Results" },
					{ id: "cooks", label: "Cooks" },
				].map((tab) => (
					<button
						key={tab.id}
						onClick={() => setAdminTab(tab.id as typeof adminTab)}
						type="button"
						className={cx(
							"flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition",
							adminTab === tab.id
								? "bg-[var(--c-brand)] text-white"
								: "text-[var(--c-text-muted)] hover:text-[var(--c-text-mid)]",
						)}
					>
						{tab.label}
					</button>
				))}
			</div>

			{/* Guest Requests (always shown) */}
			{data.pendingGuests.length > 0 && (
				<section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] p-4">
					<h2 className="text-sm font-semibold text-[var(--c-text-dark)]">
						Guest requests
					</h2>
					<div className="mt-3 grid gap-2">
						{data.pendingGuests.map((guest) => (
							<div
								className="flex items-center justify-between gap-3 rounded-xl bg-[var(--c-row)] px-3 py-3"
								key={guest.id}
							>
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold">{guest.name}</p>
									<p className="text-xs text-[var(--c-text-muted)]">
										{guest.company ?? "Unknown company"}
									</p>
								</div>
								<div className="flex shrink-0 gap-2">
									<button
										onClick={() =>
											void updateGuestRequest({
												type: "reject",
												userId: guest.id,
											}).then(onRefresh)
										}
										type="button"
										className="min-h-9 rounded-lg border border-[var(--c-border)] px-3 text-xs font-semibold text-[var(--c-text-mid)]"
									>
										Decline
									</button>
									<button
										onClick={() =>
											void updateGuestRequest({
												type: "approve",
												userId: guest.id,
											}).then(onRefresh)
										}
										type="button"
										className="min-h-9 rounded-lg bg-[var(--c-brand)] px-3 text-xs font-semibold text-white"
									>
										Approve
									</button>
								</div>
							</div>
						))}
					</div>
				</section>
			)}

			{/* Today's Choices Tab */}
			{adminTab === "today" && (
				<section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-card)] p-4">
					<h2 className="text-sm font-semibold text-[var(--c-text-dark)]">
						Users
					</h2>
					<div className="relative mt-3">
						<input
							aria-label="Search users"
							className="h-10 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-3 pr-10 text-sm outline-none focus:border-[var(--c-brand-lt)]"
							onChange={(event) => setUserSearch(event.target.value)}
							placeholder="Search users by name or email"
							value={userSearch}
						/>
						{userSearch && (
							<button
								aria-label="Clear user search"
								className="absolute right-1 top-1 grid size-8 place-items-center rounded-md text-[var(--c-text-muted)] hover:bg-[var(--c-muted)]"
								onClick={() => setUserSearch("")}
								type="button"
							>
								<XIcon size={15} />
							</button>
						)}
					</div>
					<div className="mt-3 grid gap-3">
						{filteredUsers.map((poll) => {
							const rowId = poll.user.id ?? poll.user.email;
							return (
								<AdminResponseRow
									expanded={openUserId === rowId}
									key={rowId}
									poll={poll}
									onRefresh={onRefresh}
									onToggle={() =>
										setOpenUserId((current) =>
											current === rowId ? null : rowId,
										)
									}
								/>
							);
						})}
						{filteredUsers.length === 0 && (
							<p className="py-3 text-sm text-[var(--c-text-muted)]">
								No users found.
							</p>
						)}
					</div>
				</section>
			)}

			{/* Results Tab */}
			{adminTab === "results" && (
				<AdminResultsView
					data={data}
					cooks={cooks}
					onSendToCook={(period, results) => {
						setSendToCookData({ period, selectedCook: null, results });
					}}
				/>
			)}

			{/* Cooks Tab */}
			{adminTab === "cooks" && (
				<AdminCooksView
					cooks={cooks}
					loading={loadingCooks}
					editingCook={editingCook}
					showAddCook={showAddCook}
					onRefresh={() => {
						setLoadingCooks(true);
						void getCooks()
							.then((res) => setCooks(res.cooks))
							.finally(() => setLoadingCooks(false));
					}}
					onEdit={(cook) => setEditingCook(cook)}
					onShowAdd={() => setShowAddCook(true)}
					onCloseAdd={() => setShowAddCook(false)}
					onCloseEdit={() => setEditingCook(null)}
				/>
			)}

			{/* Send to Cook Modal */}
			{sendToCookData?.results && (
				<SendToCookModal
					results={sendToCookData.results}
					period={sendToCookData.period}
					selectedCook={sendToCookData.selectedCook}
					cooks={cooks.filter((c) => c.isActive)}
					onSelectCook={(cook) =>
						setSendToCookData({ ...sendToCookData, selectedCook: cook })
					}
					onClose={() => setSendToCookData(null)}
				/>
			)}
		</div>
	);
}
function AdminResponseRow({
	poll,
	expanded,
	onToggle,
	onRefresh,
}: {
	poll: PollRecord;
	expanded: boolean;
	onToggle: () => void;
	onRefresh: () => void;
}) {
	const update = (period: Period, drink: Drink, sugar = poll.sugar[period]) => {
		if (!poll.user.id) return;
		void updateUserResponse({
			userId: poll.user.id,
			period,
			drink,
			sugar: drink === "No drink" ? true : sugar,
		}).then(onRefresh);
	};
	const removeGuest = () => {
		if (!poll.user.id) return;
		void updateGuestRequest({ type: "removeGuest", userId: poll.user.id }).then(
			onRefresh,
		);
	};
	return (
		<article className="rounded-xl bg-[var(--c-row)] p-3">
			<button
				onClick={onToggle}
				type="button"
				className="flex min-h-10 w-full items-center justify-between gap-3 text-left"
			>
				<div className="min-w-0">
					<p className="truncate text-sm font-semibold">
						{compactName(poll.user)}
					</p>
					<p className="mt-1 truncate text-xs text-[var(--c-text-muted)]">
						Morning: {poll.choices.morning} · Evening: {poll.choices.evening}
					</p>
				</div>
				<ChevronRight
					className={cx(
						"shrink-0 text-[var(--c-text-muted)] transition",
						expanded && "rotate-90",
					)}
					size={16}
				/>
			</button>
			{expanded && (
				<div className="mt-3 border-t border-[var(--c-border)] pt-3">
					<div className="grid gap-3 sm:grid-cols-2">
						{periods.map((period) => (
							<AdminPeriodControl
								key={period}
								period={period}
								drink={poll.choices[period]}
								sugar={poll.sugar[period]}
								source={poll.sources[period]}
								onDrinkChange={(drink) => update(period, drink)}
								onSugarChange={(sugar) =>
									update(period, poll.choices[period], sugar)
								}
								onAvailabilityChange={(status) => {
									if (!poll.user.id) return;
									void updateUserAvailability({
										userId: poll.user.id,
										period,
										status,
									}).then(onRefresh);
								}}
								availability={poll.availability[period]}
							/>
						))}
					</div>
					{isGuestUser(poll.user) && (
						<button
							onClick={removeGuest}
							type="button"
							className="mt-3 min-h-9 rounded-lg border border-[var(--c-border-err)] px-3 text-xs font-semibold text-[var(--c-text-err)]"
						>
							Remove guest
						</button>
					)}
				</div>
			)}
		</article>
	);
}
function AdminPeriodControl({
	period,
	drink,
	sugar,
	source,
	availability,
	onDrinkChange,
	onSugarChange,
	onAvailabilityChange,
}: {
	period: Period;
	drink: Drink;
	sugar: boolean;
	source: PollSource;
	availability: AttendanceStatus;
	onDrinkChange: (drink: Drink) => void;
	onSugarChange: (sugar: boolean) => void;
	onAvailabilityChange: (status: AttendanceStatus) => void;
}) {
	return (
		<section className="rounded-xl border border-[var(--c-border-2)] bg-[var(--c-card)] p-3">
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-xs font-semibold text-[var(--c-text-muted)]">
					{period === "morning" ? "Morning" : "Evening"}
				</h3>
				<MetaTag muted>{sourceLabel(source)}</MetaTag>
			</div>
			<select
				className="mt-2 h-10 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-2 text-sm font-semibold text-[var(--c-text-mid)]"
				onChange={(event) => onDrinkChange(event.target.value as Drink)}
				value={drink}
			>
				{drinks.map((item) => (
					<option key={item}>{item}</option>
				))}
			</select>
			<label className="mt-2 block text-[11px] font-semibold text-[var(--c-text-muted)]">
				Attendance
				<select
					aria-label={`${period} attendance`}
					className="mt-1 h-9 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-card)] px-2 text-xs font-semibold text-[var(--c-text-mid)]"
					onChange={(event) =>
						onAvailabilityChange(event.target.value as AttendanceStatus)
					}
					value={availability}
				>
					<option value="office">In office</option>
					<option value="wfh">Working from home</option>
					<option value="leave">On leave</option>
				</select>
			</label>
			<div className="mt-3 flex min-h-7 items-center justify-between gap-3">
				<SugarToggle
					compact
					disabled={drink === "No drink"}
					sugar={sugar}
					onChange={onSugarChange}
				/>
			</div>
		</section>
	);
}
