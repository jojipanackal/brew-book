import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { loadDotenvx } from "../../dotenvx";
import { getPostgresConnectionConfig } from "./connection.ts";
import * as schema from "./schema.ts";

loadDotenvx();

const pool = new Pool(getPostgresConnectionConfig());

export const db = drizzle(pool, { schema });
