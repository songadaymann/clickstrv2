const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy a new Clickstr V2 season using existing infrastructure
 *
 * This script deploys a new ClickstrGameV2 for a new season.
 * It assumes ClickRegistry and ClickstrTreasury already exist.
 *
 * Environment variables:
 *   REGISTRY_ADDRESS     - Address of existing ClickRegistry (REQUIRED)
 *   TREASURY_ADDRESS     - Address of existing ClickstrTreasury (REQUIRED)
 *   ATTESTATION_SIGNER   - Address that signs claim attestations (REQUIRED)
 *   SEASON_NUMBER        - Season number (REQUIRED)
 *   SEASON_EPOCHS        - Number of epochs (default: 3)
 *   SEASON_DURATION      - Epoch duration in seconds (default: 86400)
 *   SEASON_POOL          - Token pool for this season in whole tokens (default: 3000000)
 *   NFT_CONTRACT_ADDRESS - Address of ClickstrNFTV2 for tier bonuses (optional)
 *   FUND_TREASURY        - Set to 'true' to transfer more tokens to treasury
 *   CLICK_TOKEN_ADDRESS  - Required if FUND_TREASURY=true
 *
 * Example:
 *   REGISTRY_ADDRESS=0x... TREASURY_ADDRESS=0x... ATTESTATION_SIGNER=0x... \
 *   SEASON_NUMBER=3 SEASON_POOL=5000000 \
 *     npx hardhat run scripts/deploy-v2-season.js --network sepolia
 */
async function main() {
  // Required: infrastructure addresses
  const registryAddress = process.env.REGISTRY_ADDRESS;
  const treasuryAddress = process.env.TREASURY_ADDRESS;
  const attestationSigner = process.env.ATTESTATION_SIGNER;
  const seasonNumber = parseInt(process.env.SEASON_NUMBER);

  if (!registryAddress) {
    console.error("ERROR: REGISTRY_ADDRESS environment variable is required");
    process.exit(1);
  }
  if (!treasuryAddress) {
    console.error("ERROR: TREASURY_ADDRESS environment variable is required");
    process.exit(1);
  }
  if (!attestationSigner) {
    console.error("ERROR: ATTESTATION_SIGNER environment variable is required");
    process.exit(1);
  }
  if (!seasonNumber || isNaN(seasonNumber)) {
    console.error("ERROR: SEASON_NUMBER environment variable is required");
    process.exit(1);
  }

  // Configuration
  const totalEpochs = parseInt(process.env.SEASON_EPOCHS || "3");
  const epochDuration = parseInt(process.env.SEASON_DURATION || "86400");
  const seasonPool = process.env.SEASON_POOL || "3000000";
  const fundTreasury = process.env.FUND_TREASURY === "true";

  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  const isMainnet = network.chainId === 1n;

  console.log("=".repeat(70));
  console.log(`CLICKSTR V2 - SEASON ${seasonNumber} DEPLOYMENT`);
  console.log("=".repeat(70));

  console.log("\nNetwork:", networkName, isMainnet ? "(MAINNET - BE CAREFUL!)" : "");
  console.log("Chain ID:", network.chainId.toString());

  console.log("\nExisting Infrastructure:");
  console.log("  ClickRegistry:", registryAddress);
  console.log("  ClickstrTreasury:", treasuryAddress);

  console.log("\nSeason Configuration:");
  console.log("  Season Number:", seasonNumber);
  console.log("  Total Epochs:", totalEpochs);
  console.log("  Epoch Duration:", epochDuration, "seconds", `(${epochDuration / 3600} hours)`);
  console.log("  Season Pool:", seasonPool, "CLICK");
  console.log("  Season Length:", (totalEpochs * epochDuration) / 86400, "days");

  console.log("\nAttestation Signer:", attestationSigner);
  console.log("Deployer:", deployer.address);

  // Check treasury balance
  const treasury = await hre.ethers.getContractAt("ClickstrTreasury", treasuryAddress);
  const treasuryBalance = await treasury.getBalance();
  const seasonPoolWei = hre.ethers.parseEther(seasonPool);

  console.log("\nTreasury Balance:", hre.ethers.formatEther(treasuryBalance), "CLICK");

  if (treasuryBalance < seasonPoolWei) {
    console.log("\nWARNING: Treasury balance is less than season pool!");

    if (fundTreasury) {
      const clickTokenAddress = process.env.CLICK_TOKEN_ADDRESS;
      if (!clickTokenAddress) {
        console.error("ERROR: CLICK_TOKEN_ADDRESS required when FUND_TREASURY=true");
        process.exit(1);
      }

      const clickToken = await hre.ethers.getContractAt("IERC20", clickTokenAddress);
      const neededAmount = seasonPoolWei - treasuryBalance;

      console.log("Transferring", hre.ethers.formatEther(neededAmount), "CLICK to treasury...");
      const transferTx = await clickToken.transfer(treasuryAddress, neededAmount);
      await transferTx.wait();
      console.log("Treasury funded!");
    } else {
      console.error("Set FUND_TREASURY=true and CLICK_TOKEN_ADDRESS to fund treasury");
      process.exit(1);
    }
  }

  // Mainnet warning
  if (isMainnet) {
    console.log("\n" + "WARNING ".repeat(10));
    console.log("You are deploying to MAINNET!");
    console.log("WARNING ".repeat(10));
    console.log("\nPress Ctrl+C within 10 seconds to cancel...");
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  // Step 1: Check registry doesn't already have this season
  const registry = await hre.ethers.getContractAt("ClickRegistry", registryAddress);
  const existingGame = await registry.seasonToGame(seasonNumber);
  if (existingGame !== "0x0000000000000000000000000000000000000000") {
    console.error(`\nERROR: Season ${seasonNumber} already has a game contract: ${existingGame}`);
    process.exit(1);
  }

  // Step 2: Deploy ClickstrGameV2
  console.log("\n1. Deploying ClickstrGameV2...");
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

  // Step 3: Authorize game in registry
  console.log("\n2. Authorizing game in registry...");
  const authRegTx = await registry.authorizeGame(gameAddress, seasonNumber);
  await authRegTx.wait();
  console.log("   Game authorized for season", seasonNumber);

  // Step 4: Authorize game in treasury
  console.log("\n3. Authorizing game as treasury disburser...");
  const authTreasTx = await treasury.authorizeDisburser(gameAddress, seasonPoolWei);
  await authTreasTx.wait();
  console.log("   Game authorized with allowance:", seasonPool, "CLICK");

  // Step 5: Set up NFT bonuses (if NFT contract provided)
  const nftContractAddress = process.env.NFT_CONTRACT_ADDRESS;
  if (nftContractAddress) {
    console.log("\n4. Setting achievement NFT contract...");
    const setNftTx = await game.setAchievementNFT(nftContractAddress);
    await setNftTx.wait();
    console.log("   Achievement NFT set to:", nftContractAddress);

    console.log("\n5. Setting up NFT tier bonuses...");
    const bonusTiers = [4, 6, 8, 9, 11];
    const bonusAmounts = [200, 300, 500, 700, 1000]; // 2%, 3%, 5%, 7%, 10%
    const bonusTx = await game.setTierBonuses(bonusTiers, bonusAmounts);
    await bonusTx.wait();
    console.log("   Tier bonuses configured (2%-10%)");
  } else {
    console.log("\n4-5. Skipping NFT bonuses (no NFT_CONTRACT_ADDRESS provided)");
  }

  // Step 6: Start the game
  console.log("\n6. Starting the game...");
  const startTx = await game.startGame(seasonPoolWei);
  await startTx.wait();
  console.log("   Game started!");

  // Get game info
  const gameStats = await game.getGameStats();
  console.log("\n5. Game Stats:");
  console.log("   Pool remaining:", hre.ethers.formatEther(gameStats.poolRemaining_), "CLICK");
  console.log("   Season:", gameStats.seasonNumber_.toString());
  console.log("   Current epoch:", gameStats.currentEpoch_.toString(), "of", totalEpochs);
  console.log("   Start time:", new Date(Number(gameStats.gameStartTime_) * 1000).toISOString());
  console.log("   End time:", new Date(Number(gameStats.gameEndTime_) * 1000).toISOString());

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
      clickRegistry: registryAddress,
      clickstrTreasury: treasuryAddress,
      clickstrGameV2: gameAddress
    },
    signers: {
      attestation: attestationSigner
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

  const deploymentPath = path.join(networkDir, `deployment-v2-season${seasonNumber}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n6. Deployment info saved to:", deploymentPath);

  console.log("\n" + "=".repeat(70));
  console.log(`SEASON ${seasonNumber} DEPLOYMENT COMPLETE!`);
  console.log("=".repeat(70));

  console.log("\nContract Address:");
  console.log("  ClickstrGameV2:", gameAddress);

  console.log("\nVerification command:");
  console.log(`  npx hardhat verify --network ${networkName} ${gameAddress} ${registryAddress} ${treasuryAddress} ${seasonNumber} ${totalEpochs} ${epochDuration} ${attestationSigner}`);

  console.log("\n" + "=".repeat(70));
  console.log("NEXT STEPS:");
  console.log("=".repeat(70));
  console.log("\n1. Update frontend config (src-ts/src/config/network.ts):");
  console.log(`   contractAddress: '${gameAddress}'`);
  console.log("\n2. Update Vercel env var for mann.cool API:");
  console.log(`   CLICKSTR_GAME_V2_ADDRESS=${gameAddress}`);
  console.log("\n3. Reset Redis click data (if testing):");
  console.log(`   curl -X POST https://mann.cool/api/clickstr-admin-reset -H "Content-Type: application/json" -d '{"secret": "YOUR_ADMIN_SECRET"}'`);
  console.log("\n4. (Optional) Deploy/update subgraph for new game contract");

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
