import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadDotenvx } from "../dotenvx";
import { Pool } from "pg";
import { getPostgresConnectionConfig } from "../src/db/connection";

// Ensure we are resolving paths relative to the project root
const ROOT_DIR = process.cwd();

// In CI, DATABASE_URL is injected directly by the workflow. Do not load
// .env.production there because migrations do not need the encrypted auth/
// Google values and dotenvx would require its private key.
if (!process.env.DATABASE_URL) {
    loadDotenvx();
}

const databaseConfig = getPostgresConnectionConfig();
const pool = new Pool(databaseConfig);

const db = drizzle(pool);

async function runMigrations() {
    try {
        console.log("Connecting to the database to migrate...");
        // Point exactly to the drizzle folder at the root of your project
        await migrate(db, { migrationsFolder: path.join(ROOT_DIR, "drizzle") });
        
        console.log("✅ MIGRATIONS COMPLETED SUCCESSFULLY!");
    } catch (error) {
        console.error("\n❌ MIGRATION FAILED. RAW ERROR ❌");
        console.error(error);
        process.exit(1); // Ensure GitHub Actions fails if this crashes!
    } finally {
        await pool.end();
    }
}

runMigrations();
