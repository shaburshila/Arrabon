import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

let dbClient: SupabaseClient<Database, "public"> | null = null;

function getRequiredEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required Supabase environment variable: ${name}`);
  }

  return value;
}

export function getDbClient(): SupabaseClient<Database, "public"> {
  if (dbClient) {
    return dbClient;
  }

  dbClient = createClient<Database>(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      db: {
        schema: "public",
      },
    },
  ) as SupabaseClient<Database, "public">;

  return dbClient;
}
