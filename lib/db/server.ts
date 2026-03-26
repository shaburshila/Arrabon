import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

let serverDbClient: SupabaseClient<Database, "public"> | null = null;

function getRequiredEnv(name: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required Supabase environment variable: ${name}`);
  }

  return value;
}

export function getServerDbClient(): SupabaseClient<Database, "public"> {
  if (serverDbClient) {
    return serverDbClient;
  }

  serverDbClient = createClient<Database>(
    getRequiredEnv("SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      db: {
        schema: "public",
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  ) as SupabaseClient<Database, "public">;

  return serverDbClient;
}
