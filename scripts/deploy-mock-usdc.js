const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("Deploying MockUSDC");
  console.log(`Network: ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH`);

  const token = await hre.ethers.deployContract("MockUSDC");
  await token.waitForDeployment();

  const deploymentTx = token.deploymentTransaction();
  const receipt = deploymentTx ? await deploymentTx.wait() : null;

  console.log(`MockUSDC deployed to: ${token.target}`);

  if (receipt) {
    console.log(`Deployment block: ${receipt.blockNumber}`);
    console.log(`Deployment tx: ${receipt.hash}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
