import { existsSync, readFileSync } from "node:fs";

function resolveCertificate(value: string | undefined) {
	if (!value) return undefined;
	if (existsSync(value)) return readFileSync(value, "utf8");
	return value.includes("\\n") ? value.replaceAll("\\n", "\n") : value;
}

function removeSslMode(connectionString: string) {
	const url = new URL(connectionString);
	url.searchParams.delete("sslmode");
	url.searchParams.delete("uselibpqcompat");
	return url.toString();
}

export function getPostgresConnectionConfig() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl)
		throw new Error("DATABASE_URL is required to connect to Postgres");

	const ca =
		resolveCertificate(process.env.DATABASE_CA_CERT) ??
		resolveCertificate(process.env.NODE_EXTRA_CA_CERTS);
	return {
		connectionString: removeSslMode(databaseUrl),
		ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: true },
	};
}
