const hre = require("hardhat");

function readRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseAddress(name) {
  return hre.ethers.getAddress(readRequiredEnv(name));
}

function parseAdminWallets() {
  const rawValue = readRequiredEnv("ADMIN_WALLETS");

  return rawValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => hre.ethers.getAddress(entry));
}

function parseFundingAuthorizerAddress() {
  return parseAddress("FUNDING_AUTHORIZER_ADDRESS");
}

function parseEscrowOwnerAddress() {
  return parseAddress("ESCROW_OWNER_ADDRESS");
}

function parseOptionalComplianceHoldSignerAddress() {
  const rawKey = process.env.COMPLIANCE_HOLD_SIGNER_PRIVATE_KEY?.trim();

  if (!rawKey) {
    return null;
  }

  return hre.ethers.computeAddress(rawKey);
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const usdcAddress = parseAddress("USDC_ADDRESS");
  const treasuryAddress = parseAddress("TREASURY_ADDRESS");
  const escrowOwnerAddress = parseEscrowOwnerAddress();
  const adminWallets = parseAdminWallets();
  const fundingAuthorizerAddress = parseFundingAuthorizerAddress();
  const complianceHoldSignerAddress = parseOptionalComplianceHoldSignerAddress();

  if (complianceHoldSignerAddress && !adminWallets.includes(complianceHoldSignerAddress)) {
    throw new Error("COMPLIANCE_HOLD_SIGNER_PRIVATE_KEY address must be included in ADMIN_WALLETS.");
  }

  console.log("Deploying ConsultEscrow");
  console.log(`Network: ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH`);
  console.log(`USDC: ${usdcAddress}`);
  console.log(`Treasury: ${treasuryAddress}`);
  console.log(`Owner: ${escrowOwnerAddress}`);
  console.log(`Admins: ${adminWallets.join(", ")}`);
  console.log(`Funding authorizer: ${fundingAuthorizerAddress}`);
  if (complianceHoldSignerAddress) {
    console.log(`Compliance hold signer: ${complianceHoldSignerAddress}`);
  }

  const escrow = await hre.ethers.deployContract("ConsultEscrow", [
    usdcAddress,
    treasuryAddress,
    escrowOwnerAddress,
    adminWallets,
    fundingAuthorizerAddress,
  ]);
  await escrow.waitForDeployment();

  const deploymentTx = escrow.deploymentTransaction();
  const receipt = deploymentTx ? await deploymentTx.wait() : null;

  console.log(`ConsultEscrow deployed to: ${escrow.target}`);

  if (receipt) {
    console.log(`Deployment block: ${receipt.blockNumber}`);
    console.log(`Deployment tx: ${receipt.hash}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
