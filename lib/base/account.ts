export type BaseAccountAdapter = {
  sdkAvailable: boolean;
  sdkVersion: string | null;
  connect: () => Promise<never>;
};

type BaseAccountModule = {
  VERSION?: string;
};

export async function loadBaseAccountModule(): Promise<BaseAccountModule | null> {
  try {
    const mod = (await import("@base-org/account")) as BaseAccountModule;
    return mod;
  } catch {
    return null;
  }
}

export async function createBaseAccountAdapter(): Promise<BaseAccountAdapter> {
  const baseAccountModule = await loadBaseAccountModule();

  return {
    sdkAvailable: baseAccountModule !== null,
    sdkVersion: baseAccountModule?.VERSION ?? null,
    async connect() {
      // TODO(Sprint1): bind Base Account runtime context to wagmi connection flow.
      throw new Error("Base Account connect flow is intentionally deferred to Sprint 1.");
    },
  };
}
