import { ethers } from "hardhat";
import { writeFileSync } from "fs";
import { join } from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Deploy DelegationRegistry
  console.log("\nDeploying DelegationRegistry...");
  const DelegationRegistry = await ethers.getContractFactory("DelegationRegistry");
  const delegationRegistry = await DelegationRegistry.deploy();
  await delegationRegistry.waitForDeployment();
  const delegationRegistryAddress = await delegationRegistry.getAddress();
  console.log("DelegationRegistry deployed to:", delegationRegistryAddress);

  // Deploy TaxeeManager
  console.log("\nDeploying TaxeeManager...");
  const TaxeeManager = await ethers.getContractFactory("TaxeeManager");
  const taxeeManager = await TaxeeManager.deploy(delegationRegistryAddress);
  await taxeeManager.waitForDeployment();
  const taxeeManagerAddress = await taxeeManager.getAddress();
  console.log("TaxeeManager deployed to:", taxeeManagerAddress);

  // Configure contracts
  console.log("\nConfiguring contracts...");
  
  // Set TaxeeManager in DelegationRegistry
  await (await delegationRegistry.setTaxeeManager(taxeeManagerAddress)).wait();
  console.log("TaxeeManager set in DelegationRegistry");

  // Configure authorized executor (deployer for now)
  await (await taxeeManager.setAuthorizedExecutor(deployer.address, true)).wait();
  console.log("Deployer authorized as executor");

  // Set Circle relayer (deployer for now - update with actual relayer)
  await (await taxeeManager.setCircleRelayer(deployer.address)).wait();
  console.log("Circle relayer set to deployer (update with actual address)");

  // Configure allowed assets
  const usdcSepolia = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  await (await taxeeManager.setAllowedAsset("0x0000000000000000000000000000000000000000", true)).wait(); // ETH
  await (await taxeeManager.setAllowedAsset(usdcSepolia, true)).wait(); // USDC
  console.log("ETH and USDC configured as allowed assets");

  // Set parameters
  await (await taxeeManager.setSlippageTolerance(100)).wait(); // 1%
  await (await taxeeManager.setRebuyCooldown(300)).wait(); // 5 minutes
  console.log("Parameters configured");

  // Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number(await ethers.provider.getNetwork().then(n => n.chainId)),
    delegationRegistry: delegationRegistryAddress,
    taxeeManager: taxeeManagerAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  const deploymentPath = join(__dirname, "..", "deployments", `${deploymentInfo.chainId}.json`);
  writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info saved to:", deploymentPath);

  // Print summary
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Network:", deploymentInfo.network, `(chainId: ${deploymentInfo.chainId})`);
  console.log("DelegationRegistry:", delegationRegistryAddress);
  console.log("TaxeeManager:", taxeeManagerAddress);
  console.log("==========================\n");

  // Verification instructions
  console.log("To verify contracts on BaseScan:");
  console.log(`npx hardhat verify --network baseSepolia ${delegationRegistryAddress}`);
  console.log(`npx hardhat verify --network baseSepolia ${taxeeManagerAddress} ${delegationRegistryAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
