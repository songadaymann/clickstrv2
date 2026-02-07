const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy Clickstr V2 infrastructure
 *
 * This script deploys the V2 architecture:
 *   1. ClickRegistry (permanent, one-time)
 *   2. ClickstrTreasury (permanent, one-time)
 *   3. ClickstrGameV2 (per-season)
 *   4. ClickstrNFTV2 (optional, if upgrading NFT contract)
 *
 * For subsequent seasons, use deploy-v2-season.js instead.
 *
 * Environment variables:
 *   CLICK_TOKEN_ADDRESS  - Address of the $CLICK token (REQUIRED)
 *   ATTESTATION_SIGNER   - Address that signs claim attestations (REQUIRED)
 *   NFT_SIGNER_ADDRESS   - Address that signs NFT claims (REQUIRED)
 *   NFT_BASE_URI         - Base URI for NFT metadata (REQUIRED)
 *   SEASON_NUMBER        - Season number (default: 2)
 *   SEASON_EPOCHS        - Number of epochs (default: 3)
 *   SEASON_DURATION      - Epoch duration in seconds (default: 86400)
 *   SEASON_POOL          - Token pool for this season in whole tokens (default: 3000000)
 *   TREASURY_INITIAL     - Initial treasury funding in whole tokens (default: SEASON_POOL)
 *   SKIP_TREASURY        - Set to 'true' to skip treasury deployment (use existing)
 *   SKIP_REGISTRY        - Set to 'true' to skip registry deployment (use existing)
 *   TREASURY_ADDRESS     - Existing treasury address (required if SKIP_TREASURY=true)
 *   REGISTRY_ADDRESS     - Existing registry address (required if SKIP_REGISTRY=true)
 *   SEED_S1_DATA         - Set to 'true' to seed Season 1 historical data
 *   S1_USERS             - Comma-separated list of S1 user addresses (for seeding)
 *   S1_CLICKS            - Comma-separated list of S1 click counts (for seeding)
 *   S1_EARNINGS          - Comma-separated list of S1 earnings in whole tokens (for seeding)
 *
 * Example (full deployment):
 *   CLICK_TOKEN_ADDRESS=0x... ATTESTATION_SIGNER=0x... NFT_SIGNER_ADDRESS=0x... \
 *   NFT_BASE_URI="ipfs://Qm.../clickstr-metadata/" SEASON_POOL=3000000 \
 *     npx hardhat run scripts/deploy-v2.js --network sepolia
 */
async function main() {
  // Required: token address
  const clickTokenAddress = process.env.CLICK_TOKEN_ADDRESS;
  if (!clickTokenAddress) {
    console.error("ERROR: CLICK_TOKEN_ADDRESS environment variable is required");
    process.exit(1);
  }

  // Required: attestation signer
  const attestationSigner = process.env.ATTESTATION_SIGNER;
  if (!attestationSigner) {
    console.error("ERROR: ATTESTATION_SIGNER environment variable is required");
    console.error("This is the address that signs claim attestations (server wallet)");
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

  // Configuration
  const seasonNumber = parseInt(process.env.SEASON_NUMBER || "2");
  const totalEpochs = parseInt(process.env.SEASON_EPOCHS || "3");
  const epochDuration = parseInt(process.env.SEASON_DURATION || "86400");
  const seasonPool = process.env.SEASON_POOL || "3000000";
  const treasuryInitial = process.env.TREASURY_INITIAL || seasonPool;

  const skipTreasury = process.env.SKIP_TREASURY === "true";
  const skipRegistry = process.env.SKIP_REGISTRY === "true";
  const existingTreasury = process.env.TREASURY_ADDRESS;
  const existingRegistry = process.env.REGISTRY_ADDRESS;

  if (skipTreasury && !existingTreasury) {
    console.error("ERROR: TREASURY_ADDRESS required when SKIP_TREASURY=true");
    process.exit(1);
  }
  if (skipRegistry && !existingRegistry) {
    console.error("ERROR: REGISTRY_ADDRESS required when SKIP_REGISTRY=true");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  const isMainnet = network.chainId === 1n;

  console.log("=".repeat(70));
  console.log("CLICKSTR V2 - FULL INFRASTRUCTURE DEPLOYMENT");
  console.log("=".repeat(70));

  console.log("\nNetwork:", networkName, isMainnet ? "(MAINNET - BE CAREFUL!)" : "");
  console.log("Chain ID:", network.chainId.toString());

  console.log("\nConfiguration:");
  console.log("  Season Number:", seasonNumber);
  console.log("  Total Epochs:", totalEpochs);
  console.log("  Epoch Duration:", epochDuration, "seconds", `(${epochDuration / 3600} hours)`);
  console.log("  Season Pool:", seasonPool, "CLICK");
  console.log("  Treasury Initial:", treasuryInitial, "CLICK");
  console.log("  Season Length:", (totalEpochs * epochDuration) / 86400, "days");

  console.log("\nSigners:");
  console.log("  Attestation Signer:", attestationSigner);
  console.log("  NFT Signer:", nftSignerAddress);

  console.log("\nDeployer:", deployer.address);
  const ethBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("ETH Balance:", hre.ethers.formatEther(ethBalance), "ETH");

  // Check deployer's token balance
  const clickToken = await hre.ethers.getContractAt("IERC20", clickTokenAddress);
  const tokenBalance = await clickToken.balanceOf(deployer.address);
  const treasuryAmountWei = hre.ethers.parseEther(treasuryInitial);

  console.log("$CLICK Balance:", hre.ethers.formatEther(tokenBalance), "CLICK");

  if (!skipTreasury && tokenBalance < treasuryAmountWei) {
    console.error("\n ERROR: Insufficient token balance!");
    console.error(`   Need: ${treasuryInitial} CLICK`);
    console.error(`   Have: ${hre.ethers.formatEther(tokenBalance)} CLICK`);
    process.exit(1);
  }

  // Mainnet warning
  if (isMainnet) {
    console.log("\n" + "WARNING ".repeat(10));
    console.log("You are deploying to MAINNET!");
    console.log("WARNING ".repeat(10));
    console.log("\nPress Ctrl+C within 10 seconds to cancel...");
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  let registryAddress, treasuryAddress;

  // Step 1: Deploy ClickRegistry (or use existing)
  if (skipRegistry) {
    registryAddress = existingRegistry;
    console.log("\n1. Using existing ClickRegistry:", registryAddress);
  } else {
    console.log("\n1. Deploying ClickRegistry...");
    const ClickRegistry = await hre.ethers.getContractFactory("ClickRegistry");
    const registry = await ClickRegistry.deploy();
    await registry.waitForDeployment();
    registryAddress = await registry.getAddress();
    console.log("   ClickRegistry deployed to:", registryAddress);
  }

  // Step 2: Deploy ClickstrTreasury (or use existing)
  if (skipTreasury) {
    treasuryAddress = existingTreasury;
    console.log("\n2. Using existing ClickstrTreasury:", treasuryAddress);
  } else {
    console.log("\n2. Deploying ClickstrTreasury...");
    const ClickstrTreasury = await hre.ethers.getContractFactory("ClickstrTreasury");
    const treasury = await ClickstrTreasury.deploy(clickTokenAddress);
    await treasury.waitForDeployment();
    treasuryAddress = await treasury.getAddress();
    console.log("   ClickstrTreasury deployed to:", treasuryAddress);

    // Fund treasury
    console.log("\n3. Funding treasury with", treasuryInitial, "CLICK...");
    const transferTx = await clickToken.transfer(treasuryAddress, treasuryAmountWei);
    await transferTx.wait();
    console.log("   Treasury funded!");
  }

  // Step 3 (or 4): Deploy ClickstrNFTV2
  console.log("\n4. Deploying ClickstrNFTV2...");
  const ClickstrNFTV2 = await hre.ethers.getContractFactory("ClickstrNFTV2");
  const nft = await ClickstrNFTV2.deploy(registryAddress, nftSignerAddress, nftBaseURI);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("   ClickstrNFTV2 deployed to:", nftAddress);

  // Step 4 (or 5): Deploy ClickstrGameV2
  console.log("\n5. Deploying ClickstrGameV2...");
  const ClickstrGameV2 = await hre.ethers.getContractFactory("ClickstrGameV2");
  const game = await ClickstrGameV2.deploy(
    registryAddress,
    treasuryAddress,
    seasonNumber,
    totalEpochs,
    epochDuration,
    attestationSigner
  );
  await game.waitForDeployment();
  const gameAddress = await game.getAddress();
  console.log("   ClickstrGameV2 deployed to:", gameAddress);

  // Step 5 (or 6): Authorize game in registry
  console.log("\n6. Authorizing game in registry...");
  const registry = await hre.ethers.getContractAt("ClickRegistry", registryAddress);
  const authRegTx = await registry.authorizeGame(gameAddress, seasonNumber);
  await authRegTx.wait();
  console.log("   Game authorized for season", seasonNumber);

  // Step 6 (or 7): Authorize game in treasury
  console.log("\n7. Authorizing game as treasury disburser...");
  const treasury = await hre.ethers.getContractAt("ClickstrTreasury", treasuryAddress);
  const seasonPoolWei = hre.ethers.parseEther(seasonPool);
  const authTreasTx = await treasury.authorizeDisburser(gameAddress, seasonPoolWei);
  await authTreasTx.wait();
  console.log("   Game authorized with allowance:", seasonPool, "CLICK");

  // Optional: Seed S1 historical data
  if (process.env.SEED_S1_DATA === "true") {
    console.log("\n8. Seeding Season 1 historical data...");
    const s1Users = (process.env.S1_USERS || "").split(",").filter(a => a);
    const s1Clicks = (process.env.S1_CLICKS || "").split(",").map(c => BigInt(c || "0"));
    const s1EarningsRaw = (process.env.S1_EARNINGS || "").split(",").map(e => e.trim()).filter(e => e);
    const s1Earnings = s1EarningsRaw.map(e => hre.ethers.parseEther(e));

    if (s1Users.length > 0 && s1Users.length === s1Clicks.length) {
      const seedTx = await registry.seedHistoricalClicks(s1Users, s1Clicks, 1);
      await seedTx.wait();
      console.log("   Seeded", s1Users.length, "users from Season 1");
    } else {
      console.log("   Skipped - no valid S1 data provided");
    }

    if (s1Earnings.length > 0 && s1Users.length === s1Earnings.length) {
      const seedEarnTx = await registry.seedHistoricalEarnings(s1Users, s1Earnings, 1);
      await seedEarnTx.wait();
      console.log("   Seeded earnings for", s1Users.length, "users from Season 1");
    } else if (s1Earnings.length > 0) {
      console.log("   Skipped earnings - S1_EARNINGS length must match S1_USERS");
    }
  }

  // Step 8: Set achievement NFT for bonus system
  console.log("\n8. Setting achievement NFT contract...");
  const setNftTx = await game.setAchievementNFT(nftAddress);
  await setNftTx.wait();
  console.log("   Achievement NFT set to:", nftAddress);

  // Step 9: Set tier bonuses
  console.log("\n9. Setting up NFT tier bonuses...");
  const bonusTiers = [4, 6, 8, 9, 11];
  const bonusAmounts = [200, 300, 500, 700, 1000]; // 2%, 3%, 5%, 7%, 10%
  const bonusTx = await game.setTierBonuses(bonusTiers, bonusAmounts);
  await bonusTx.wait();
  console.log("   Tier bonuses configured:");
  console.log("     Tier 4  (1K clicks):   2%");
  console.log("     Tier 6  (10K clicks):  3%");
  console.log("     Tier 8  (50K clicks):  5%");
  console.log("     Tier 9  (100K clicks): 7%");
  console.log("     Tier 11 (500K clicks): 10%");

  // Step 10: Start the game
  console.log("\n10. Starting the game...");
  const startTx = await game.startGame(seasonPoolWei);
  await startTx.wait();
  console.log("   Game started!");

  // Get game info
  const gameStats = await game.getGameStats();
  console.log("\n10. Game Stats:");
  console.log("   Pool remaining:", hre.ethers.formatEther(gameStats.poolRemaining_), "CLICK");
  console.log("   Season:", gameStats.seasonNumber_.toString());
  console.log("   Current epoch:", gameStats.currentEpoch_.toString(), "of", totalEpochs);
  console.log("   Start time:", new Date(Number(gameStats.gameStartTime_) * 1000).toISOString());
  console.log("   End time:", new Date(Number(gameStats.gameEndTime_) * 1000).toISOString());

  // Check treasury balance
  const treasuryBalance = await treasury.getBalance();
  console.log("\n11. Treasury balance:", hre.ethers.formatEther(treasuryBalance), "CLICK");

  // Save deployment info
  const deploymentInfo = {
    version: "v2",
    network: networkName,
    chainId: Number(network.chainId),
    season: {
      number: seasonNumber,
      totalEpochs,
      epochDuration,
      poolAmount: seasonPool,
      seasonLengthDays: (totalEpochs * epochDuration) / 86400
    },
    contracts: {
      clickToken: clickTokenAddress,
      clickRegistry: registryAddress,
      clickstrTreasury: treasuryAddress,
      clickstrGameV2: gameAddress,
      clickstrNFTV2: nftAddress
    },
    signers: {
      attestation: attestationSigner,
      nft: nftSignerAddress
    },
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    gameStartTime: new Date(Number(gameStats.gameStartTime_) * 1000).toISOString(),
    gameEndTime: new Date(Number(gameStats.gameEndTime_) * 1000).toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber()
  };

  // Save to network folder
  const networkDir = path.join(__dirname, "..", networkName);
  if (!fs.existsSync(networkDir)) {
    fs.mkdirSync(networkDir, { recursive: true });
  }

  const deploymentPath = path.join(networkDir, "deployment-v2.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n12. Deployment info saved to:", deploymentPath);

  console.log("\n" + "=".repeat(70));
  console.log("V2 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(70));

  console.log("\nContract Addresses:");
  console.log("  $CLICK Token:       ", clickTokenAddress);
  console.log("  ClickRegistry:      ", registryAddress);
  console.log("  ClickstrTreasury:   ", treasuryAddress);
  console.log("  ClickstrGameV2:     ", gameAddress);
  console.log("  ClickstrNFTV2:      ", nftAddress);

  console.log("\nVerification commands:");
  console.log(`  npx hardhat verify --network ${networkName} ${registryAddress}`);
  console.log(`  npx hardhat verify --network ${networkName} ${treasuryAddress} ${clickTokenAddress}`);
  console.log(`  npx hardhat verify --network ${networkName} ${nftAddress} ${registryAddress} ${nftSignerAddress} "${nftBaseURI}"`);
  console.log(`  npx hardhat verify --network ${networkName} ${gameAddress} ${registryAddress} ${treasuryAddress} ${seasonNumber} ${totalEpochs} ${epochDuration} ${attestationSigner}`);

  console.log("\n" + "=".repeat(70));
  console.log("NEXT STEPS:");
  console.log("=".repeat(70));
  console.log("\n1. Update frontend config (src-ts/src/config/network.ts):");
  console.log(`   contractAddress: '${gameAddress}'`);
  console.log(`   nftContractAddress: '${nftAddress}'`);
  console.log(`   // Registry: '${registryAddress}'`);
  console.log("\n2. Update Vercel env vars for mann.cool API:");
  console.log(`   CLICKSTR_GAME_V2_ADDRESS=${gameAddress}`);
  console.log("\n3. Ensure attestation signer key is configured on server");
  console.log("\n4. (Optional) Deploy/update subgraph for new contracts");
  console.log("\n5. For future seasons, use deploy-v2-season.js with:");
  console.log(`   REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`   TREASURY_ADDRESS=${treasuryAddress}`);

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
