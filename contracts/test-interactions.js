const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🧪 Testing EIP-7702 Contract Interactions\n");
  
  // Load deployment info
  const deploymentsPath = path.join(__dirname, "deployments", "84532.json");
  if (!fs.existsSync(deploymentsPath)) {
    console.error("❌ Deployment not found. Run deployment first.");
    process.exit(1);
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  console.log("📋 Loaded deployment:");
  console.log("   DelegationRegistry:", deployment.delegationRegistry);
  console.log("   TaxeeManager:", deployment.taxeeManager);
  console.log("");
  
  const ethers = hre.ethers;
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const user = signers[1] || deployer; // Use deployer as user if no second account
  
  console.log("👤 Test accounts:");
  console.log("   Deployer:", deployer.address);
  console.log("   User:", user.address);
  console.log("   Note:", signers.length > 1 ? "Using separate user account" : "Using deployer as user (no separate account available)");
  console.log("");
  
  // Connect to contracts
  const DelegationRegistry = await ethers.getContractFactory("DelegationRegistry");
  const delegationRegistry = DelegationRegistry.attach(deployment.delegationRegistry);
  
  const TaxeeManager = await ethers.getContractFactory("TaxeeManager");
  const taxeeManager = TaxeeManager.attach(deployment.taxeeManager);
  
  console.log("✅ Connected to contracts\n");
  
  // Test 1: Check TaxeeManager is set in DelegationRegistry
  console.log("📍 Test 1: Contract Configuration");
  const taxeeManagerInRegistry = await delegationRegistry.taxeeManager();
  console.log("   TaxeeManager in DelegationRegistry:", taxeeManagerInRegistry);
  console.log("   Expected:", deployment.taxeeManager);
  console.log("   Match:", taxeeManagerInRegistry.toLowerCase() === deployment.taxeeManager.toLowerCase() ? "✅" : "❌");
  console.log("");
  
  // Test 2: Check authorized executor
  console.log("📍 Test 2: Executor Authorization");
  const isExecutor = await taxeeManager.authorizedExecutors(deployer.address);
  console.log("   Deployer is executor:", isExecutor ? "✅" : "❌");
  console.log("");
  
  // Test 3: Check Circle relayer
  console.log("📍 Test 3: Circle Relayer");
  const circleRelayer = await taxeeManager.circleRelayer();
  console.log("   Circle Relayer:", circleRelayer);
  console.log("   Match deployer:", circleRelayer.toLowerCase() === deployer.address.toLowerCase() ? "✅" : "❌");
  console.log("");
  
  // Test 4: Check allowed assets
  console.log("📍 Test 4: Allowed Assets");
  const ethAllowed = await taxeeManager.allowedAssets("0x0000000000000000000000000000000000000000");
  const usdcAllowed = await taxeeManager.allowedAssets("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
  console.log("   ETH allowed:", ethAllowed ? "✅" : "❌");
  console.log("   USDC allowed:", usdcAllowed ? "✅" : "❌");
  console.log("");
  
  // Test 5: Check parameters
  console.log("📍 Test 5: Contract Parameters");
  const slippage = await taxeeManager.slippageTolerance();
  const cooldown = await taxeeManager.rebuyCooldown();
  console.log("   Slippage tolerance:", slippage.toString(), "basis points (1%)");
  console.log("   Rebuy cooldown:", cooldown.toString(), "seconds (5 min)");
  console.log("");
  
  // Test 6: Simulate delegation creation (without actual signature)
  console.log("📍 Test 6: Delegation Simulation");
  
  // Check if user has delegation (should be false initially)
  const [hasDelegation, expiration] = await delegationRegistry.hasActiveDelegation(user.address);
  console.log("   User has delegation:", hasDelegation ? "Yes" : "No (expected)");
  console.log("   Can create new delegation:", !hasDelegation ? "✅" : "❌");
  console.log("");
  
  // Test 7: Check canExecute for non-delegated user
  console.log("📍 Test 7: Execution Validation (User without delegation)");
  const [canExecute, reason] = await taxeeManager.canExecute(
    user.address,
    0, // HARVEST
    "0x0000000000000000000000000000000000000000", // ETH
    ethers.utils.parseUnits("1000", 18) // $1,000
  );
  console.log("   Can execute:", canExecute ? "Yes" : "No (expected - no delegation)");
  console.log("   Reason:", reason);
  console.log("");
  
  // Test 8: Check monthly limits for user
  console.log("📍 Test 8: Monthly Limits (User without delegation)");
  const [remaining, monthStart] = await delegationRegistry.getRemainingMonthlyLimit(user.address);
  console.log("   Remaining monthly limit:", ethers.utils.formatUnits(remaining, 18), "USD");
  console.log("   Month start:", new Date(Number(monthStart) * 1000).toISOString());
  console.log("");
  
  console.log("=".repeat(60));
  console.log("✅ All tests completed!");
  console.log("=".repeat(60));
  console.log("\n📖 Next Steps:");
  console.log("   1. Test actual delegation creation via frontend");
  console.log("   2. Test harvest execution flow");
  console.log("   3. Verify Circle MPC integration");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ TEST FAILED:\n", error);
    process.exit(1);
  });
