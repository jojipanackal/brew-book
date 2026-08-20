import { ChevronRight, X as XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
	Alert,
	Button,
	Card,
	Empty,
	IconButton,
	Input,
	ListRow,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui";
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
					<Card className="p-4" key={period}>
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
								<Button
									onClick={() => onSendToCook(period, results)}
									type="button"
									size="sm"
								>
									Send to Cook
								</Button>
							)}
						</div>

						{hasDrinks ? (
							<div className="mt-3 space-y-2">
								{Object.entries(results.results)
									.filter(([drink]) => drink !== "No drink")
									.map(
										([drink, count]) =>
											count > 0 && (
												<ListRow key={drink} className="rounded-lg py-2">
													<span className="text-sm text-[var(--c-text-mid)]">
														{drink}
													</span>
													<span className="font-semibold text-[var(--c-brand)]">
														{count}
													</span>
												</ListRow>
											),
									)}
							</div>
						) : (
							<Empty className="mt-4 py-4 text-xs">
								No responses have been recorded for this poll.
							</Empty>
						)}
					</Card>
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
			<Card className="p-4">
				<div className="flex items-center justify-between gap-3">
					<h2 className="text-sm font-semibold text-[var(--c-text-dark)]">
						Cooks
					</h2>
					<Button onClick={onShowAdd} type="button" size="sm">
						+ Add Cook
					</Button>
				</div>

				{loading ? (
					<div className="mt-4 text-center text-xs text-[var(--c-text-muted)]">
						Loading cooks...
					</div>
				) : cooks.length === 0 ? (
					<Empty className="mt-4 py-4 text-xs">No cooks added yet</Empty>
				) : (
					<div className="mt-3 space-y-2">
						{cooks.map((cook) => (
							<ListRow
								key={cook.id}
								className={cx(
									"rounded-lg py-3",
									!cook.isActive && "bg-[var(--c-muted)] opacity-60",
								)}
							>
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold">{cook.name}</p>
									<p className="mt-1 truncate text-xs text-[var(--c-text-muted)]">
										+{cook.phoneNumber}
									</p>
								</div>
								<div className="flex shrink-0 gap-2">
									<Button
										onClick={() => onEdit(cook)}
										type="button"
										variant="secondary"
										size="sm"
									>
										Edit
									</Button>
								</div>
							</ListRow>
						))}
					</div>
				)}
			</Card>

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
			<Card className="w-full max-w-md p-6">
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
						<Input
							id="add-cook-name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Cook name"
							className="mt-1"
						/>
					</div>

					<div>
						<label
							htmlFor="add-cook-phone"
							className="block text-xs font-semibold text-[var(--c-text-mid)]"
						>
							Phone Number
						</label>
						<Input
							id="add-cook-phone"
							type="text"
							value={phone}
							onChange={(e) => setPhone(e.target.value)}
							placeholder="+91 98765 43210"
							className="mt-1"
						/>
						<p className="mt-1 text-xs text-[var(--c-text-muted)]">
							Include country code (e.g., +91 for India)
						</p>
					</div>

					{error && <Alert className="mt-2 text-xs">{error}</Alert>}
				</div>

				<div className="mt-6 flex gap-3">
					<Button
						onClick={onClose}
						type="button"
						variant="secondary"
						disabled={saving}
						className="flex-1"
					>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						type="button"
						disabled={saving}
						className="flex-1"
					>
						{saving ? "Saving..." : "Add"}
					</Button>
				</div>
			</Card>
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
			<Card className="w-full max-w-md p-6">
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
						<Input
							id="edit-cook-name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="mt-1"
						/>
					</div>

					<div>
						<label
							htmlFor="edit-cook-phone"
							className="block text-xs font-semibold text-[var(--c-text-mid)]"
						>
							Phone Number
						</label>
						<Input
							id="edit-cook-phone"
							type="text"
							value={phone}
							onChange={(e) => setPhone(e.target.value)}
							className="mt-1"
						/>
					</div>

					<ListRow className="rounded-lg py-3">
						<label
							htmlFor="edit-cook-active"
							className="flex flex-1 cursor-pointer items-center gap-3"
						>
							<input
								type="checkbox"
								id="edit-cook-active"
								checked={isActive}
								onChange={(e) => setIsActive(e.target.checked)}
								className="h-4 w-4"
							/>
							<span className="text-sm font-semibold text-[var(--c-text-dark)]">
								Active
							</span>
						</label>
					</ListRow>

					{error && <Alert className="mt-2 text-xs">{error}</Alert>}
				</div>

				<div className="mt-6 flex gap-3">
					<Button
						onClick={onClose}
						type="button"
						variant="secondary"
						disabled={saving}
						className="flex-1"
					>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						type="button"
						disabled={saving}
						className="flex-1"
					>
						{saving ? "Saving..." : "Save"}
					</Button>
				</div>
			</Card>
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
				<Card className="w-full max-w-md p-6">
					<h2 className="text-lg font-semibold text-[var(--c-text-dark)]">
						Send Poll Result
					</h2>
					<p className="mt-1 text-sm text-[var(--c-text-muted)]">
						{period === "morning" ? "Morning" : "Evening"} Results
					</p>

					{cooks.length === 0 ? (
						<Alert className="mt-4 text-sm" variant="warning">
							<p>No cooks have been added yet.</p>
							<p className="mt-2 text-xs">
								Add a cook from Admin → Cooks to send poll results.
							</p>
						</Alert>
					) : (
						<div className="mt-4 space-y-2">
							{cooks.map((cook) => (
								<Button
									key={cook.id}
									onClick={() => {
										onSelectCook(cook);
										setStep("preview");
									}}
									type="button"
									variant="ghost"
									fullWidth
									className="items-start justify-between rounded-lg border border-[var(--c-border)] bg-[var(--c-row)] px-3 py-3 text-left hover:bg-[var(--c-card)]"
								>
									<p className="font-semibold text-[var(--c-text-dark)]">
										{cook.name}
									</p>
									<p className="mt-1 text-xs text-[var(--c-text-muted)]">
										+{cook.phoneNumber}
									</p>
								</Button>
							))}
						</div>
					)}

					<div className="mt-6 flex gap-3">
						<Button
							onClick={onClose}
							type="button"
							variant="secondary"
							className="flex-1"
						>
							Close
						</Button>
					</div>
				</Card>
			</div>
		);
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<Card className="w-full max-w-md p-6">
				<h2 className="text-lg font-semibold text-[var(--c-text-dark)]">
					Send to Cook
				</h2>

				<div className="mt-4 space-y-4">
					<div>
						<p className="text-xs font-semibold text-[var(--c-text-mid)]">
							Cook
						</p>
						<ListRow className="mt-2 rounded-lg py-3">
							<p className="font-semibold text-[var(--c-text-dark)]">
								{selectedCook.name}
							</p>
							<p className="mt-1 text-sm text-[var(--c-text-muted)]">
								+{selectedCook.phoneNumber}
							</p>
						</ListRow>
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
					<Button
						onClick={() => setStep("select")}
						type="button"
						variant="secondary"
						className="flex-1"
					>
						Back
					</Button>
					<Button
						asChild
						variant="green"
						size="sm"
						className="flex-1 text-sm no-underline"
					>
						<a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
							Open WhatsApp
						</a>
					</Button>
				</div>
			</Card>
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
					<Button
						key={tab.id}
						onClick={() => setAdminTab(tab.id as typeof adminTab)}
						type="button"
						variant={adminTab === tab.id ? "primary" : "ghost"}
						className="flex-1"
					>
						{tab.label}
					</Button>
				))}
			</div>

			{/* Guest Requests (always shown) */}
			{data.pendingGuests.length > 0 && (
				<Card className="p-4">
					<h2 className="text-sm font-semibold text-[var(--c-text-dark)]">
						Guest requests
					</h2>
					<div className="mt-3 grid gap-2">
						{data.pendingGuests.map((guest) => (
							<ListRow key={guest.id} className="py-3">
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold">{guest.name}</p>
									<p className="text-xs text-[var(--c-text-muted)]">
										{guest.company ?? "Unknown company"}
									</p>
								</div>
								<div className="flex shrink-0 gap-2">
									<Button
										onClick={() =>
											void updateGuestRequest({
												type: "reject",
												userId: guest.id,
											}).then(onRefresh)
										}
										type="button"
										variant="secondary"
										size="sm"
										className="min-h-9"
									>
										Decline
									</Button>
									<Button
										onClick={() =>
											void updateGuestRequest({
												type: "approve",
												userId: guest.id,
											}).then(onRefresh)
										}
										type="button"
										size="sm"
										className="min-h-9"
									>
										Approve
									</Button>
								</div>
							</ListRow>
						))}
					</div>
				</Card>
			)}

			{/* Today's Choices Tab */}
			{adminTab === "today" && (
				<Card className="p-4">
					<h2 className="text-sm font-semibold text-[var(--c-text-dark)]">
						Users
					</h2>
					<div className="relative mt-3">
						<Input
							aria-label="Search users"
							className="pr-10"
							onChange={(event) => setUserSearch(event.target.value)}
							placeholder="Search users by name or email"
							value={userSearch}
						/>
						{userSearch && (
							<IconButton
								className="absolute right-1 top-1 size-8"
								onClick={() => setUserSearch("")}
								aria-label="Clear user search"
							>
								<XIcon size={15} />
							</IconButton>
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
				</Card>
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
		<ListRow className="flex-col items-stretch py-3">
			<Button
				onClick={onToggle}
				type="button"
				variant="ghost"
				fullWidth
				className="min-h-10 items-center justify-between gap-3 text-left"
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
			</Button>
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
						<Button
							onClick={removeGuest}
							type="button"
							variant="danger"
							size="sm"
							className="mt-3 min-h-9"
						>
							Remove guest
						</Button>
					)}
				</div>
			)}
		</ListRow>
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
		<Card variant="accent" className="p-3">
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-xs font-semibold text-[var(--c-text-muted)]">
					{period === "morning" ? "Morning" : "Evening"}
				</h3>
				<MetaTag muted>{sourceLabel(source)}</MetaTag>
			</div>
			<Select
				value={drink}
				onValueChange={(value) => onDrinkChange(value as Drink)}
			>
				<SelectTrigger className="mt-2">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{drinks.map((item) => (
						<SelectItem value={item} key={item}>
							{item}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<label
				htmlFor="attendance"
				className="mt-2 block text-[11px] font-semibold text-[var(--c-text-muted)]"
			>
				Attendance
				<Select
					value={availability}
					onValueChange={(value) =>
						onAvailabilityChange(value as AttendanceStatus)
					}
				>
					<SelectTrigger
						id="attendance"
						aria-label={`${period} attendance`}
						className="mt-1 h-9 text-xs"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="office">In office</SelectItem>
						<SelectItem value="wfh">Working from home</SelectItem>
						<SelectItem value="leave">On leave</SelectItem>
					</SelectContent>
				</Select>
			</label>
			<div className="mt-3 flex min-h-7 items-center justify-between gap-3">
				<SugarToggle
					compact
					disabled={drink === "No drink"}
					sugar={sugar}
					onChange={onSugarChange}
				/>
			</div>
		</Card>
	);
}
