import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getPostgresConnectionConfig } from "../src/db/connection";
import {
	attendance,
	company,
	companyAdmin,
	drinkDefault,
	drinkResponse,
	user,
} from "../src/db/schema";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
if (
	!(["127.0.0.1", "localhost", "::1"] as string[]).includes(databaseUrl.hostname) ||
	databaseName !== "brewbook_local"
) {
	throw new Error(
		"Local seed refused: DATABASE_URL must target brewbook_local on localhost",
	);
}

const pool = new Pool(getPostgresConnectionConfig());
const db = drizzle(pool);
const localCompany = {
	id: "local-demo",
	name: "Local Demo Company",
	emailEnding1: "@brewbook.local",
};
const fakeUsers = [
	{
		id: "local-user-admin",
		name: "Asha Admin",
		email: "asha@brewbook.local",
		role: "admin" as const,
	},
	{
		id: "local-user-1",
		name: "Ben Thomas",
		email: "ben@brewbook.local",
		role: "user" as const,
	},
	{
		id: "local-user-2",
		name: "Chitra Nair",
		email: "chitra@brewbook.local",
		role: "user" as const,
	},
	{
		id: "local-user-3",
		name: "Deepak Rao",
		email: "deepak@brewbook.local",
		role: "user" as const,
	},
	{
		id: "local-user-4",
		name: "Eva Joseph",
		email: "eva@brewbook.local",
		role: "user" as const,
	},
];
const drinkPreferences = [
	{ morning: "Tea", evening: "Coffee", morningSugar: true, eveningSugar: false },
	{ morning: "Coffee", evening: "Tea", morningSugar: false, eveningSugar: true },
	{ morning: "Green tea", evening: "Milk", morningSugar: false, eveningSugar: false },
	{ morning: "Black Coffee", evening: "No drink", morningSugar: false, eveningSugar: true },
	{ morning: "Black Tea", evening: "Tea", morningSugar: true, eveningSugar: false },
] as const;
const periods = ["morning", "evening"] as const;
const indiaDateFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Asia/Kolkata",
});

function recentDateKeys(days: number) {
	const today = indiaDateFormatter.format(new Date());
	const cursor = new Date(`${today}T12:00:00Z`);
	return Array.from({ length: days }, (_, index) => {
		const date = new Date(cursor);
		date.setUTCDate(date.getUTCDate() - index);
		return date.toISOString().slice(0, 10);
	});
}

async function seed() {
	await db.transaction(async (tx) => {
		await tx
			.insert(company)
			.values(localCompany)
			.onConflictDoUpdate({
				target: company.id,
				set: {
					name: localCompany.name,
					emailEnding1: localCompany.emailEnding1,
					updatedAt: new Date(),
				},
			});

		for (const fakeUser of fakeUsers) {
			await tx
				.insert(user)
				.values({
					...fakeUser,
					company: localCompany.name,
					companyId: localCompany.id,
					emailVerified: true,
				})
				.onConflictDoUpdate({
					target: user.id,
					set: {
						name: fakeUser.name,
						email: fakeUser.email,
						company: localCompany.name,
						companyId: localCompany.id,
						role: fakeUser.role,
						emailVerified: true,
						updatedAt: new Date(),
					},
				});
		}

		await tx
			.insert(companyAdmin)
			.values({
				id: "local-company-admin",
				companyId: localCompany.id,
				email: fakeUsers[0].email,
			})
			.onConflictDoNothing();

		const localAdminEmail = process.env.LOCAL_ADMIN_EMAIL?.trim().toLowerCase();
		if (localAdminEmail) {
			const companies = await tx.select().from(company);
			const matchedCompany = companies.find((item) =>
				[item.emailEnding1, item.emailEnding2].some(
					(ending) => ending && localAdminEmail.endsWith(ending.toLowerCase()),
				),
			);
			if (!matchedCompany) {
				throw new Error(
					`LOCAL_ADMIN_EMAIL does not match a configured company: ${localAdminEmail}`,
				);
			}
			await tx
				.insert(companyAdmin)
				.values({
					id: `local-admin-${localAdminEmail.replace(/[^a-z0-9]/g, "-")}`,
					companyId: matchedCompany.id,
					email: localAdminEmail,
				})
				.onConflictDoNothing();
		}

		for (const [index, fakeUser] of fakeUsers.entries()) {
			const preference = drinkPreferences[index];
			await tx
				.insert(drinkDefault)
				.values([
					{
						userId: fakeUser.id,
						period: "morning",
						drink: preference.morning,
						sugar: preference.morningSugar,
					},
					{
						userId: fakeUser.id,
						period: "evening",
						drink: preference.evening,
						sugar: preference.eveningSugar,
					},
				])
				.onConflictDoNothing();
		}

		const responseRows = recentDateKeys(14).flatMap((date, dayIndex) =>
			fakeUsers.flatMap((fakeUser, userIndex) => {
				const preference = drinkPreferences[userIndex];
				return periods.map((period) => {
					const unavailable =
						(userIndex === 2 && dayIndex % 5 === 1 && period === "evening") ||
						(userIndex === 4 && dayIndex % 7 === 3);
					return {
						id: `local-response-${date}-${fakeUser.id}-${period}`,
						userId: fakeUser.id,
						date,
						period,
						drink: unavailable ? ("No drink" as const) : preference[period],
						sugar: unavailable
							? true
							: preference[period === "morning" ? "morningSugar" : "eveningSugar"],
						source: dayIndex % 3 === 0 ? ("manual" as const) : ("default" as const),
					};
				});
			}),
		);
		await tx.insert(drinkResponse).values(responseRows).onConflictDoNothing();

		const attendanceRows = recentDateKeys(14).flatMap((date, dayIndex) => {
			const rows = [];
			if (dayIndex % 5 === 1) {
				rows.push({
					id: `local-attendance-${date}-local-user-2-evening`,
					userId: "local-user-2",
					date,
					period: "evening" as const,
					status: "wfh" as const,
				});
			}
			if (dayIndex % 7 === 3) {
				for (const period of periods) {
					rows.push({
						id: `local-attendance-${date}-local-user-4-${period}`,
						userId: "local-user-4",
						date,
						period,
						status: "leave" as const,
					});
				}
			}
			return rows;
		});
		if (attendanceRows.length) {
			await tx.insert(attendance).values(attendanceRows).onConflictDoNothing();
		}

		await tx
			.insert(user)
			.values({
				id: "local-guest-pending",
				name: "Pending Guest",
				email: "local-guest-pending@guest.brewbook.local",
				company: localCompany.name,
				companyId: localCompany.id,
				role: "guest",
				isGuest: true,
				guestToken: "local-pending-guest-token",
				guestStatus: "pending",
				guestRequestedAt: new Date(),
				emailVerified: false,
			})
			.onConflictDoNothing();
	});

	console.log(
		`Seeded ${fakeUsers.length} users, 14 days of drink history, attendance, and a pending guest.`,
	);
	if (process.env.LOCAL_ADMIN_EMAIL) {
		console.log(`Granted company admin access to ${process.env.LOCAL_ADMIN_EMAIL}.`);
	}
}

try {
	await seed();
} finally {
	await pool.end();
}
