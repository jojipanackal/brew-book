import { existsSync, readFileSync } from "node:fs";

function resolveCertificate(value: string | undefined) {
	if (!value) return undefined;
	if (existsSync(value)) return readFileSync(value, "utf8");
	return value.includes("\\n") ? value.replaceAll("\\n", "\n") : value;
}

function parseDatabaseUrl(connectionString: string) {
	const url = new URL(connectionString);
	const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
	url.searchParams.delete("sslmode");
	url.searchParams.delete("uselibpqcompat");
	return { connectionString: url.toString(), sslMode };
}

export function getPostgresSslConfig() {
	const { sslMode } = parseDatabaseUrl(process.env.DATABASE_URL ?? "");
	const ca =
		resolveCertificate(process.env.DATABASE_CA_CERT) ??
		resolveCertificate(process.env.NODE_EXTRA_CA_CERTS);

	if (ca) return { ca, rejectUnauthorized: true };

	// A container-to-container PostgreSQL URL normally has no sslmode and should
	// use plain TCP. Keep URL-only support for hosted databases that explicitly
	// request TLS, while allowing `require` to work without a provider CA bundle.
	if (sslMode === "require" || sslMode === "prefer") {
		return { rejectUnauthorized: false };
	}
	if (sslMode === "verify-ca" || sslMode === "verify-full") {
		return { rejectUnauthorized: true };
	}

	return false;
}

export function getPostgresConnectionConfig() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl)
		throw new Error("DATABASE_URL is required to connect to Postgres");

	const { connectionString } = parseDatabaseUrl(databaseUrl);
	return {
		connectionString,
		ssl: getPostgresSslConfig(),
	};
}
