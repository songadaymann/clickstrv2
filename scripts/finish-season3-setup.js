const hre = require("hardhat");

/**
 * Finish Season 3 setup after the deploy script crashed mid-way.
 * The contract was deployed successfully but the remaining steps
 * (authorize in registry, authorize in treasury, set NFT, start game)
 * were not completed.
 *
 * Contract: 0xf6055889a000dfe93ce3795ebc99d2f44b2282f1
 */
async function main() {
  const gameAddress = "0xf6055889a000dfe93ce3795ebc99d2f44b2282f1";
  const registryAddress = process.env.REGISTRY_ADDRESS;
  const treasuryAddress = process.env.TREASURY_ADDRESS;
  const nftContractAddress = process.env.NFT_CONTRACT_ADDRESS;
  const seasonNumber = 3;
  const seasonPool = "3000000";
  const seasonPoolWei = hre.ethers.parseEther(seasonPool);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Game contract:", gameAddress);

  // Verify the contract exists and we own it
  const game = await hre.ethers.getContractAt("ClickstrGameV2", gameAddress);
  const owner = await game.owner();
  console.log("Contract owner:", owner);
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("ERROR: You are not the owner of this contract!");
    process.exit(1);
  }

  // Check if game is already started
  const gameStarted = await game.gameStarted();
  if (gameStarted) {
    console.log("Game is already started! Nothing to do.");
    return;
  }

  // Step 1: Authorize game in registry
  console.log("\n1. Authorizing game in registry...");
  const registry = await hre.ethers.getContractAt("ClickRegistry", registryAddress);
  const existingGame = await registry.seasonToGame(seasonNumber);
  if (existingGame.toLowerCase() === gameAddress.toLowerCase()) {
    console.log("   Already authorized in registry.");
  } else if (existingGame !== "0x0000000000000000000000000000000000000000") {
    console.error(`   ERROR: Season ${seasonNumber} already has a different game: ${existingGame}`);
    process.exit(1);
  } else {
    const authRegTx = await registry.authorizeGame(gameAddress, seasonNumber);
    await authRegTx.wait();
    console.log("   Game authorized for season", seasonNumber);
  }

  // Step 2: Authorize game in treasury
  console.log("\n2. Authorizing game as treasury disburser...");
  const treasury = await hre.ethers.getContractAt("ClickstrTreasury", treasuryAddress);
  const isAuthorized = await treasury.authorizedDisbursers(gameAddress);
  if (isAuthorized) {
    console.log("   Already authorized in treasury.");
  } else {
    const authTreasTx = await treasury.authorizeDisburser(gameAddress, seasonPoolWei);
    await authTreasTx.wait();
    console.log("   Game authorized with allowance:", seasonPool, "CLICK");
  }

  // Step 3: Set up NFT bonuses
  if (nftContractAddress) {
    console.log("\n3. Setting achievement NFT contract...");
    const setNftTx = await game.setAchievementNFT(nftContractAddress);
    await setNftTx.wait();
    console.log("   Achievement NFT set to:", nftContractAddress);

    console.log("\n4. Setting up NFT tier bonuses...");
    const bonusTiers = [4, 6, 8, 9, 11];
    const bonusAmounts = [200, 300, 500, 700, 1000]; // 2%, 3%, 5%, 7%, 10%
    const bonusTx = await game.setTierBonuses(bonusTiers, bonusAmounts);
    await bonusTx.wait();
    console.log("   Tier bonuses configured (2%-10%)");
  }

  // Step 4: Start the game
  console.log("\n5. Starting the game...");
  const startTx = await game.startGame(seasonPoolWei);
  await startTx.wait();
  console.log("   Game started!");

  // Get game info
  const gameStats = await game.getGameStats();
  console.log("\nGame Stats:");
  console.log("  Pool remaining:", hre.ethers.formatEther(gameStats.poolRemaining_), "CLICK");
  console.log("  Season:", gameStats.seasonNumber_.toString());
  console.log("  Current epoch:", gameStats.currentEpoch_.toString());
  console.log("  Start time:", new Date(Number(gameStats.gameStartTime_) * 1000).toISOString());
  console.log("  End time:", new Date(Number(gameStats.gameEndTime_) * 1000).toISOString());

  console.log("\n✅ Season 3 setup complete!");
  console.log("Contract:", gameAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
