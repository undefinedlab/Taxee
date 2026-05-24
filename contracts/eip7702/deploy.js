const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    console.error("\n❌ ERROR: Account has no ETH. Get Base Sepolia ETH from:");
    console.error("   https://www.coinbase.com/faucets/base-sepolia-faucet");
    console.error("   https://www.alchemy.com/faucets/base-sepolia\n");
    process.exit(1);
  }

  // Deploy DelegationRegistry
  console.log("\n📄 Deploying DelegationRegistry...");
  const DelegationRegistry = await ethers.getContractFactory("DelegationRegistry");
  const delegationRegistry = await DelegationRegistry.deploy();
  await delegationRegistry.waitForDeployment();
  const delegationRegistryAddress = await delegationRegistry.getAddress();
  console.log("✅ DelegationRegistry deployed to:", delegationRegistryAddress);

  // Deploy TaxeeManager
  console.log("\n📄 Deploying TaxeeManager...");
  const TaxeeManager = await ethers.getContractFactory("TaxeeManager");
  const taxeeManager = await TaxeeManager.deploy(delegationRegistryAddress);
  await taxeeManager.waitForDeployment();
  const taxeeManagerAddress = await taxeeManager.getAddress();
  console.log("✅ TaxeeManager deployed to:", taxeeManagerAddress);

  // Configure contracts
  console.log("\n⚙️  Configuring contracts...");
  
  // Set TaxeeManager in DelegationRegistry
  await (await delegationRegistry.setTaxeeManager(taxeeManagerAddress)).wait();
  console.log("✅ TaxeeManager set in DelegationRegistry");

  // Configure authorized executor (deployer for now)
  await (await taxeeManager.setAuthorizedExecutor(deployer.address, true)).wait();
  console.log("✅ Deployer authorized as executor");

  // Set Circle relayer (deployer for now - update with actual relayer)
  await (await taxeeManager.setCircleRelayer(deployer.address)).wait();
  console.log("✅ Circle relayer set to deployer (update with actual address)");

  // Configure allowed assets
  const usdcSepolia = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  await (await taxeeManager.setAllowedAsset("0x0000000000000000000000000000000000000000", true)).wait(); // ETH
  await (await taxeeManager.setAllowedAsset(usdcSepolia, true)).wait(); // USDC
  console.log("✅ ETH and USDC configured as allowed assets");

  // Set parameters
  await (await taxeeManager.setSlippageTolerance(100)).wait(); // 1%
  await (await taxeeManager.setRebuyCooldown(300)).wait(); // 5 minutes
  console.log("✅ Parameters configured");

  // Save deployment info
  const network = await ethers.provider.getNetwork();
  const deploymentInfo = {
    network: network.name,
    chainId: Number(network.chainId),
    delegationRegistry: delegationRegistryAddress,
    taxeeManager: taxeeManagerAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentPath = path.join(deploymentsDir, `${deploymentInfo.chainId}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to:", deploymentPath);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEPLOYMENT SUCCESSFUL!");
  console.log("=".repeat(60));
  console.log("Network:", network.name, `(chainId: ${deploymentInfo.chainId})`);
  console.log("DelegationRegistry:", delegationRegistryAddress);
  console.log("TaxeeManager:", taxeeManagerAddress);
  console.log("=".repeat(60) + "\n");

  // Update frontend
  console.log("📝 Updating frontend configuration...");
  
  // Update wagmi.ts
  const wagmiPath = path.join(__dirname, "..", "frontend", "lib", "wagmi.ts");
  if (fs.existsSync(wagmiPath)) {
    let wagmiContent = fs.readFileSync(wagmiPath, "utf8");
    wagmiContent = wagmiContent.replace(
      /baseSepolia:\s*\{[\s\S]*?delegationRegistry:[^\n]*/,
      `baseSepolia: {
    delegationRegistry: '${deploymentInfo.delegationRegistry}',`
    );
    wagmiContent = wagmiContent.replace(
      /taxeeManager:[^\n]*$/m,
      `taxeeManager: '${deploymentInfo.taxeeManager}',
  }`
    );
    fs.writeFileSync(wagmiPath, wagmiContent);
    console.log("✅ Updated frontend/lib/wagmi.ts");
  }

  // Create .env.local
  const envPath = path.join(__dirname, "..", "frontend", ".env.local");
  const envContent = `# Contract addresses (Base Sepolia)
NEXT_PUBLIC_DELEGATION_REGISTRY_SEPOLIA=${deploymentInfo.delegationRegistry}
NEXT_PUBLIC_TAXEE_MANAGER_SEPOLIA=${deploymentInfo.taxeeManager}
`;
  fs.writeFileSync(envPath, envContent);
  console.log("✅ Updated frontend/.env.local\n");

  // Verification instructions
  console.log("🔍 To verify contracts on BaseScan:");
  console.log(`   npx hardhat verify --network baseSepolia ${delegationRegistryAddress}`);
  console.log(`   npx hardhat verify --network baseSepolia ${taxeeManagerAddress} ${delegationRegistryAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ DEPLOYMENT FAILED:\n", error.message);
    if (error.message.includes("insufficient funds")) {
      console.error("\n💡 Get Base Sepolia ETH from:");
      console.error("   https://www.coinbase.com/faucets/base-sepolia-faucet");
    }
    process.exit(1);
  });
