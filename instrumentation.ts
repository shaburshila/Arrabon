import { ensureAuthEnvironment } from "@/lib/auth/config";

export async function register() {
  ensureAuthEnvironment();
}
