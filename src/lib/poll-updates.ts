import { eq } from "drizzle-orm";
import { db } from "../db";
import { user } from "../db/schema";
import { publishPollChange } from "./poll-events";
import { ensureTodayResponses, todayKey } from "./poll-responses";

export async function refreshUserPolls(userId: string, date = todayKey()) {
	const rows = await db
		.select({ companyId: user.companyId })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	const companyId = rows[0]?.companyId;
	if (!companyId) return;
	await ensureTodayResponses(companyId, date);
	publishPollChange(companyId, date);
}
