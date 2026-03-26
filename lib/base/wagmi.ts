import { createConfig, http } from "wagmi";
import { base, baseSepolia } from "viem/chains";

import { supportedBaseChains } from "@/lib/base/chains";
import { baseRuntimeConfig } from "@/lib/base/config";

export const wagmiConfig = createConfig({
  chains: supportedBaseChains,
  ssr: true,
  transports: {
    [base.id]: http(
      baseRuntimeConfig.chain.id === base.id
        ? baseRuntimeConfig.rpcUrl
        : base.rpcUrls.default.http[0],
    ),
    [baseSepolia.id]: http(
      baseRuntimeConfig.chain.id === baseSepolia.id
        ? baseRuntimeConfig.rpcUrl
        : baseSepolia.rpcUrls.default.http[0],
    ),
  },
});
