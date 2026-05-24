import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

// Read deployment info
const deploymentPath = join(__dirname, "..", "deployments", "84532.json");
const deploymentInfo = JSON.parse(readFileSync(deploymentPath, "utf8"));

// Read current wagmi.ts
const wagmiPath = join(__dirname, "..", "frontend", "lib", "wagmi.ts");
let wagmiContent = readFileSync(wagmiPath, "utf8");

// Update contract addresses
wagmiContent = wagmiContent.replace(
  /baseSepolia:\s*\{[\s\S]*?\}/,
  `baseSepolia: {
    delegationRegistry: '${deploymentInfo.delegationRegistry}',
    taxeeManager: '${deploymentInfo.taxeeManager}',
  }`
);

// Write updated content
writeFileSync(wagmiPath, wagmiContent);
console.log("✅ Updated frontend/lib/wagmi.ts with deployed contract addresses");

// Update .env.local for frontend
const envPath = join(__dirname, "..", "frontend", ".env.local");
const envContent = `# Contract addresses (Base Sepolia)
NEXT_PUBLIC_DELEGATION_REGISTRY_SEPOLIA=${deploymentInfo.delegationRegistry}
NEXT_PUBLIC_TAXEE_MANAGER_SEPOLIA=${deploymentInfo.taxeeManager}
`;

writeFileSync(envPath, envContent);
console.log("✅ Updated frontend/.env.local with contract addresses");

console.log("\nDeployed Contracts:");
console.log("DelegationRegistry:", deploymentInfo.delegationRegistry);
console.log("TaxeeManager:", deploymentInfo.taxeeManager);
