const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy Clickstr V2 infrastructure only (no game, no funding)
 *
 * Deploys the three permanent contracts needed before starting any season:
 *   1. ClickRegistry  - permanent click record across all seasons
 *   2. ClickstrTreasury - holds $CLICK, enforces 50/50 distribution and burn
 *   3. ClickstrNFTV2   - achievement NFTs with click-based tiers
 *
 * The treasury is deployed EMPTY. You must:
 *   1. Get the treasury address allowlisted by TokenWorks (Adam)
 *   2. Transfer $CLICK tokens to the treasury
 *   3. Then deploy a season using deploy-v2-season.js
 *
 * Environment variables:
 *   CLICK_TOKEN_ADDRESS  - Address of the $CLICK token (REQUIRED)
 *                          Mainnet: 0x7ddbd0c4a0383a0f9611b715809f92c90e1d991d
 *   NFT_SIGNER_ADDRESS   - Address that signs NFT claims (REQUIRED)
 *   NFT_BASE_URI         - Base URI for NFT metadata (REQUIRED)
 *
 * Example:
 *   npx hardhat run scripts/deploy-v2-infra.js --network mainnet
 */
async function main() {
  // Required: token address
  const clickTokenAddress = process.env.CLICK_TOKEN_ADDRESS;
  if (!clickTokenAddress) {
    console.error("ERROR: CLICK_TOKEN_ADDRESS environment variable is required");
    console.error("Mainnet $CLICK: 0x7ddbd0c4a0383a0f9611b715809f92c90e1d991d");
    process.exit(1);
  }

  // Required: NFT signer
  const nftSignerAddress = process.env.NFT_SIGNER_ADDRESS;
  if (!nftSignerAddress) {
    console.error("ERROR: NFT_SIGNER_ADDRESS environment variable is required");
    process.exit(1);
  }

  // Required: NFT base URI
  const nftBaseURI = process.env.NFT_BASE_URI;
  if (!nftBaseURI) {
    console.error("ERROR: NFT_BASE_URI environment variable is required");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  const isMainnet = network.chainId === 1n;

  console.log("=".repeat(70));
  console.log("CLICKSTR V2 - INFRASTRUCTURE DEPLOYMENT (no game, no funding)");
  console.log("=".repeat(70));

  console.log("\nNetwork:", networkName, isMainnet ? "(MAINNET)" : "");
  console.log("Chain ID:", network.chainId.toString());

  console.log("\nContracts to deploy:");
  console.log("  1. ClickRegistry");
  console.log("  2. ClickstrTreasury (token:", clickTokenAddress, ")");
  console.log("  3. ClickstrNFTV2 (signer:", nftSignerAddress, ")");

  console.log("\nDeployer:", deployer.address);
  const ethBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("ETH Balance:", hre.ethers.formatEther(ethBalance), "ETH");

  if (ethBalance === 0n) {
    console.error("\nERROR: Deployer has no ETH for gas!");
    process.exit(1);
  }

  // Mainnet warning
  if (isMainnet) {
    console.log("\n" + "!".repeat(70));
    console.log("  DEPLOYING TO MAINNET");
    console.log("  This will deploy 3 contracts. NO tokens will be transferred.");
    console.log("  Treasury will be deployed EMPTY - you need TokenWorks allowlist first.");
    console.log("!".repeat(70));
    console.log("\nPress Ctrl+C within 10 seconds to cancel...");
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  // Step 1: Deploy ClickRegistry
  console.log("\n1. Deploying ClickRegistry...");
  const ClickRegistry = await hre.ethers.getContractFactory("ClickRegistry");
  const registry = await ClickRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("   ClickRegistry deployed to:", registryAddress);

  // Step 2: Deploy ClickstrTreasury
  console.log("\n2. Deploying ClickstrTreasury...");
  const ClickstrTreasury = await hre.ethers.getContractFactory("ClickstrTreasury");
  const treasury = await ClickstrTreasury.deploy(clickTokenAddress);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("   ClickstrTreasury deployed to:", treasuryAddress);

  // Confirm treasury is empty
  const treasuryBalance = await treasury.getBalance();
  console.log("   Treasury balance:", hre.ethers.formatEther(treasuryBalance), "CLICK (expected: 0)");

  // Step 3: Deploy ClickstrNFTV2
  console.log("\n3. Deploying ClickstrNFTV2...");
  const ClickstrNFTV2 = await hre.ethers.getContractFactory("ClickstrNFTV2");
  const nft = await ClickstrNFTV2.deploy(registryAddress, nftSignerAddress, nftBaseURI);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("   ClickstrNFTV2 deployed to:", nftAddress);

  // Save deployment info
  const deploymentInfo = {
    version: "v2-infra",
    network: networkName,
    chainId: Number(network.chainId),
    contracts: {
      clickToken: clickTokenAddress,
      clickRegistry: registryAddress,
      clickstrTreasury: treasuryAddress,
      clickstrNFTV2: nftAddress
    },
    signers: {
      nft: nftSignerAddress
    },
    nftBaseURI: nftBaseURI,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber()
  };

  const networkDir = path.join(__dirname, "..", networkName);
  if (!fs.existsSync(networkDir)) {
    fs.mkdirSync(networkDir, { recursive: true });
  }

  const deploymentPath = path.join(networkDir, "deployment-v2-infra.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n4. Deployment info saved to:", deploymentPath);

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("INFRASTRUCTURE DEPLOYMENT COMPLETE");
  console.log("=".repeat(70));

  console.log("\nContract Addresses:");
  console.log("  ClickRegistry:      ", registryAddress);
  console.log("  ClickstrTreasury:   ", treasuryAddress);
  console.log("  ClickstrNFTV2:      ", nftAddress);

  console.log("\nVerification commands:");
  console.log(`  npx hardhat verify --network ${networkName} ${registryAddress}`);
  console.log(`  npx hardhat verify --network ${networkName} ${treasuryAddress} ${clickTokenAddress}`);
  console.log(`  npx hardhat verify --network ${networkName} ${nftAddress} ${registryAddress} ${nftSignerAddress} "${nftBaseURI}"`);

  console.log("\n" + "=".repeat(70));
  console.log("NEXT STEPS");
  console.log("=".repeat(70));
  console.log("\n1. ALLOWLIST: Send the treasury address to Adam for TokenWorks allowlisting:");
  console.log(`   ${treasuryAddress}`);
  console.log("\n2. VERIFY: Verify contracts on Etherscan (commands above)");
  console.log("\n3. FUND: Once allowlisted, transfer $CLICK tokens to the treasury");
  console.log("\n4. START SEASON: Deploy a game using deploy-v2-season.js:");
  console.log(`   REGISTRY_ADDRESS=${registryAddress} \\`);
  console.log(`   TREASURY_ADDRESS=${treasuryAddress} \\`);
  console.log(`   NFT_CONTRACT_ADDRESS=${nftAddress} \\`);
  console.log(`   ATTESTATION_SIGNER=0x... \\`);
  console.log(`   SEASON_NUMBER=2 SEASON_POOL=3000000 \\`);
  console.log(`     npx hardhat run scripts/deploy-v2-season.js --network ${networkName}`);

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
