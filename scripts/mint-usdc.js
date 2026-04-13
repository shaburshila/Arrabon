const hre = require("hardhat");

async function main() {
  const USDC_ADDRESS = process.env.USDC_ADDRESS;
  const TO = process.env.MINT_TO;
  const AMOUNT_USDC = process.env.MINT_AMOUNT_USDC ?? "100000";

  if (!USDC_ADDRESS) throw new Error("USDC_ADDRESS not set");
  if (!TO) throw new Error("MINT_TO not set");

  const amount = hre.ethers.parseUnits(AMOUNT_USDC, 6);
  const token = await hre.ethers.getContractAt("MockUSDC", USDC_ADDRESS);

  console.log(`Minting ${AMOUNT_USDC} mUSDC → ${TO}`);
  const tx = await token.mint(TO, amount);
  const receipt = await tx.wait();

  const balance = await token.balanceOf(TO);
  console.log(`Done. Tx: ${receipt.hash}`);
  console.log(`Balance of ${TO}: ${hre.ethers.formatUnits(balance, 6)} mUSDC`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
