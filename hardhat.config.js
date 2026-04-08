require("dotenv").config({ path: ".env.local" });
require("@nomicfoundation/hardhat-toolbox");

function parseAccounts(value) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => (entry.startsWith("0x") ? entry : `0x${entry}`));
}

const baseSepoliaRpcUrl = process.env.BASE_SEPOLIA_RPC_URL?.trim() || "";
const deployerAccounts = parseAccounts(process.env.DEPLOYER_PRIVATE_KEY);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./tests/contract",
    cache: "./cache/hardhat",
    artifacts: "./artifacts/hardhat",
  },
  networks: {
    baseSepolia: {
      url: baseSepoliaRpcUrl,
      accounts: deployerAccounts,
      chainId: 84532,
    },
  },
};
