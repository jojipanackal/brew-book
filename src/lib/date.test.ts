import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { displayDate, getDateKey, shiftDateKey } from "#/lib/date";

describe("date helpers", () => {
	it("uses the app timezone across the UTC day boundary", () => {
		assert.equal(
			getDateKey(new Date("2026-01-01T18:29:59.000Z")),
			"2026-01-01",
		);
		assert.equal(
			getDateKey(new Date("2026-01-01T18:30:00.000Z")),
			"2026-01-02",
		);
	});

	it("shifts date keys across month and year boundaries", () => {
		assert.equal(shiftDateKey("2025-12-31", 1), "2026-01-01");
		assert.equal(shiftDateKey("2026-03-01", -1), "2026-02-28");
	});

	it("formats a date key without moving it to the previous day", () => {
		assert.match(displayDate("2026-07-27"), /Jul 27, 2026/);
	});
});
