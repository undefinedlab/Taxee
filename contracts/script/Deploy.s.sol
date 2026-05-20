// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/TaxeeLotRegistry.sol";
import "../src/TaxeeExecutor.sol";

/**
 * @notice Deployment script for taxee contracts on Base / Base Sepolia.
 *
 * Usage:
 *   # Dry run (no broadcast):
 *   forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL
 *
 *   # Broadcast + verify:
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $BASE_SEPOLIA_RPC_URL \
 *     --broadcast \
 *     --verify \
 *     --etherscan-api-key $BASESCAN_API_KEY
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY     Private key of the deployer EOA
 *   USYC_ADDRESS             USYC token address on target chain
 *   USDC_ADDRESS             USDC token address on target chain
 *   AUTHORIZED_CALLER        Circle Programmable Wallet address for this executor instance
 */
contract DeployTaxee is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        address usycAddr    = vm.envAddress("USYC_ADDRESS");
        address usdcAddr    = vm.envAddress("USDC_ADDRESS");
        address authCaller  = vm.envAddress("AUTHORIZED_CALLER");

        console.log("=== taxee Contract Deployment ===");
        console.log("Deployer:           ", deployer);
        console.log("USYC:               ", usycAddr);
        console.log("USDC:               ", usdcAddr);
        console.log("Authorized Caller:  ", authCaller);
        console.log("Chain ID:           ", block.chainid);

        vm.startBroadcast(deployerKey);

        // 1. Deploy TaxeeLotRegistry (no constructor args)
        TaxeeLotRegistry registry = new TaxeeLotRegistry();
        console.log("TaxeeLotRegistry:   ", address(registry));

        // 2. Deploy TaxeeExecutor (depends on registry)
        TaxeeExecutor executor = new TaxeeExecutor(
            usycAddr,
            usdcAddr,
            address(registry),
            authCaller
        );
        console.log("TaxeeExecutor:      ", address(executor));

        vm.stopBroadcast();

        console.log("=== Deployment complete ===");
        console.log("Add to backend/.env:");
        console.log("  TAXEE_LOT_REGISTRY_ADDRESS=", address(registry));
        console.log("  TAXEE_EXECUTOR_ADDRESS=     ", address(executor));
    }
}
