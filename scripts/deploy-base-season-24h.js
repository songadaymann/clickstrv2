const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const v = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(v)) return true;
  if (["0", "false", "no", "n", "off"].includes(v)) return false;
  throw new Error(`Invalid boolean value: ${value}`);
}

function parsePositiveInt(value, fallback, label) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
}

async function waitForTx(label, txPromise) {
  const tx = await txPromise;
  console.log(`[deploy] tx submitted: ${label} -> ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`[deploy] tx confirmed: ${label} (block ${receipt.blockNumber})`);
  return receipt;
}

async function waitForDeployment(label, contract) {
  const deployTx = contract.deploymentTransaction();
  if (!deployTx) {
    throw new Error(`Missing deployment tx for ${label}`);
  }
  console.log(`[deploy] tx submitted: ${label} -> ${deployTx.hash}`);
  const receipt = await deployTx.wait();
  console.log(`[deploy] tx confirmed: ${label} (block ${receipt.blockNumber})`);
  return receipt;
}

async function main() {
  const infraPath = path.join(__dirname, "..", "base", "deployment-v2-base-registry-treasury.json");
  const nftPath = path.join(__dirname, "..", "base", "deployment-v2-base-nft.json");
  const infra = readJsonIfExists(infraPath);
  const nftDeployment = readJsonIfExists(nftPath);

  const registryAddress =
    process.env.BASE_REGISTRY_ADDRESS ||
    process.env.REGISTRY_ADDRESS ||
    infra?.contracts?.clickRegistry;
  const treasuryAddress =
    process.env.BASE_TREASURY_ADDRESS ||
    process.env.TREASURY_ADDRESS ||
    infra?.contracts?.clickstrTreasury;
  const nftAddress =
    process.env.BASE_NFT_ADDRESS ||
    process.env.NFT_CONTRACT_ADDRESS ||
    nftDeployment?.contracts?.clickstrNFTV2;
  const attestationSigner = process.env.ATTESTATION_SIGNER;

  if (!registryAddress) throw new Error("Missing BASE_REGISTRY_ADDRESS / REGISTRY_ADDRESS");
  if (!treasuryAddress) throw new Error("Missing BASE_TREASURY_ADDRESS / TREASURY_ADDRESS");
  if (!attestationSigner) throw new Error("Missing ATTESTATION_SIGNER");

  const totalEpochs = parsePositiveInt(process.env.SEASON_EPOCHS, 6, "SEASON_EPOCHS");
  const epochDuration = parsePositiveInt(process.env.SEASON_DURATION, 14_400, "SEASON_DURATION");
  const seasonPool = process.env.SEASON_POOL || "100000000";
  const startGame = parseBool(process.env.START_GAME, true);
  const setNftBonuses = parseBool(process.env.SET_NFT_BONUSES, true);
  const fundTreasury = parseBool(process.env.FUND_TREASURY, false);

  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 8453) {
    throw new Error(`Expected Base mainnet (8453), got chainId ${chainId}`);
  }

  const registry = await hre.ethers.getContractAt("ClickRegistry", registryAddress);
  const treasury = await hre.ethers.getContractAt("ClickstrTreasury", treasuryAddress);

  const [registryOwner, treasuryOwner] = await Promise.all([registry.owner(), treasury.owner()]);
  if (registryOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Signer is not registry owner. signer=${deployer.address} owner=${registryOwner}`);
  }
  if (treasuryOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Signer is not treasury owner. signer=${deployer.address} owner=${treasuryOwner}`);
  }

  const seasonNumberFromEnv = process.env.SEASON_NUMBER;
  const totalSeasons = Number(await registry.totalSeasons());
  const seasonNumber = seasonNumberFromEnv
    ? parsePositiveInt(seasonNumberFromEnv, 0, "SEASON_NUMBER")
    : totalSeasons + 1;

  const seasonPoolWei = hre.ethers.parseEther(seasonPool);
  const treasuryBalance = await treasury.getBalance();
  const neededWei = seasonPoolWei > treasuryBalance ? seasonPoolWei - treasuryBalance : 0n;

  console.log("=".repeat(72));
  console.log("CLICKSTR V2 - BASE SEASON DEPLOY (24H PROFILE)");
  console.log("=".repeat(72));
  console.log("Network:", `${network.name} (${chainId})`);
  console.log("Deployer:", deployer.address);
  console.log("Registry:", registryAddress);
  console.log("Treasury:", treasuryAddress);
  console.log("NFT:", nftAddress || "(not set)");
  console.log("Attestation signer:", attestationSigner);
  console.log("Season number:", seasonNumber, seasonNumberFromEnv ? "(env)" : "(auto = totalSeasons + 1)");
  console.log("Total epochs:", totalEpochs);
  console.log("Epoch duration:", `${epochDuration}s (${(epochDuration / 3600).toFixed(2)}h)`);
  console.log("Season length:", `${(totalEpochs * epochDuration) / 3600}h`);
  console.log("Season pool:", `${seasonPool} CLICK`);
  console.log("Treasury balance:", `${hre.ethers.formatEther(treasuryBalance)} CLICK`);
  console.log("Need funding:", neededWei > 0n ? `${hre.ethers.formatEther(neededWei)} CLICK` : "0 CLICK");
  console.log("Start game:", startGame);
  console.log("Set NFT bonuses:", setNftBonuses && Boolean(nftAddress));
  console.log("Fund treasury if needed:", fundTreasury);
  console.log("=".repeat(72));

  const existingGame = await registry.seasonToGame(seasonNumber);
  if (existingGame !== "0x0000000000000000000000000000000000000000") {
    throw new Error(`Season ${seasonNumber} already has a game: ${existingGame}`);
  }

  if (neededWei > 0n) {
    if (!fundTreasury) {
      throw new Error(
        `Treasury needs ${hre.ethers.formatEther(neededWei)} more CLICK. ` +
        "Fund manually first or rerun with FUND_TREASURY=true and CLICK_TOKEN_ADDRESS."
      );
    }
    const clickTokenAddress = process.env.BASE_CLICK_TOKEN_ADDRESS || process.env.CLICK_TOKEN_ADDRESS;
    if (!clickTokenAddress) {
      throw new Error("Missing BASE_CLICK_TOKEN_ADDRESS / CLICK_TOKEN_ADDRESS for funding");
    }
    const clickToken = await hre.ethers.getContractAt("IERC20", clickTokenAddress);
    await waitForTx(
      `token.transfer treasury +${hre.ethers.formatEther(neededWei)} CLICK`,
      clickToken.transfer(treasuryAddress, neededWei)
    );
  }

  console.log("[deploy] deploying ClickstrGameV2...");
  const ClickstrGameV2 = await hre.ethers.getContractFactory("ClickstrGameV2");
  const game = await ClickstrGameV2.deploy(
    registryAddress,
    treasuryAddress,
    seasonNumber,
    totalEpochs,
    epochDuration,
    attestationSigner
  );
  const deployReceipt = await waitForDeployment("ClickstrGameV2.deploy", game);
  const gameAddress = await game.getAddress();

  const authRegistryReceipt = await waitForTx(
    `registry.authorizeGame season=${seasonNumber}`,
    registry.authorizeGame(gameAddress, seasonNumber)
  );

  const authTreasuryReceipt = await waitForTx(
    `treasury.authorizeDisburser allowance=${seasonPool} CLICK`,
    treasury.authorizeDisburser(gameAddress, seasonPoolWei)
  );

  if (setNftBonuses && nftAddress) {
    await waitForTx(
      "game.setAchievementNFT",
      game.setAchievementNFT(nftAddress)
    );
    await waitForTx(
      "game.setTierBonuses",
      game.setTierBonuses([4, 6, 8, 9, 11], [200, 300, 500, 700, 1000])
    );
  } else {
    console.log("[deploy] skipping NFT bonus config");
  }

  let startReceipt = null;
  if (startGame) {
    startReceipt = await waitForTx(
      `game.startGame pool=${seasonPool} CLICK`,
      game.startGame(seasonPoolWei)
    );
  } else {
    console.log("[deploy] START_GAME=false, game not started");
  }

  const gameStats = await game.getGameStats();
  const deploymentInfo = {
    version: "v2-base-season",
    network: network.name,
    chainId,
    season: {
      number: seasonNumber,
      totalEpochs,
      epochDuration,
      poolAmount: seasonPool,
      seasonLengthHours: (totalEpochs * epochDuration) / 3600,
    },
    contracts: {
      clickToken: infra?.contracts?.clickToken || process.env.BASE_CLICK_TOKEN_ADDRESS || process.env.CLICK_TOKEN_ADDRESS || null,
      clickRegistry: registryAddress,
      clickstrTreasury: treasuryAddress,
      clickstrNFTV2: nftAddress || null,
      clickstrGameV2: gameAddress,
    },
    signers: {
      attestation: attestationSigner,
    },
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    gameStartTime: new Date(Number(gameStats.gameStartTime_) * 1000).toISOString(),
    gameEndTime: new Date(Number(gameStats.gameEndTime_) * 1000).toISOString(),
    transactions: {
      deploy: deployReceipt.hash,
      authorizeRegistry: authRegistryReceipt.hash,
      authorizeTreasury: authTreasuryReceipt.hash,
      startGame: startReceipt?.hash || null,
    },
    blockNumber: await hre.ethers.provider.getBlockNumber(),
  };

  const outDir = path.join(__dirname, "..", "base");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `deployment-v2-base-season${seasonNumber}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n" + "=".repeat(72));
  console.log("BASE SEASON DEPLOY COMPLETE");
  console.log("=".repeat(72));
  console.log("Game:", gameAddress);
  console.log("Season:", seasonNumber);
  console.log("Pool:", `${seasonPool} CLICK`);
  console.log("Output:", outPath);
  console.log("\nSet these env vars after deploy:");
  console.log(`- CLICKSTR_GAME_V2_ADDRESS=${gameAddress}`);
  console.log(`- VITE_CLICKSTR_GAME_V2_ADDRESS=${gameAddress}`);
  console.log("\nVerify command:");
  console.log(
    `npx hardhat verify --network base ${gameAddress} ${registryAddress} ${treasuryAddress} ` +
    `${seasonNumber} ${totalEpochs} ${epochDuration} ${attestationSigner}`
  );
}

main().catch((err) => {
  console.error("[deploy] failed:", err.message);
  process.exit(1);
});
