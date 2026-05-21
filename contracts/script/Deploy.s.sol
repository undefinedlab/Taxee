// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/TaxeeLotRegistry.sol";
import "../src/TaxeeExecutor.sol";

/**
 * @notice Deployment script for taxee contracts on Base / Base Sepolia.
 *         All deployments are routed through the Arc immutable ledger for
 *         non-repudiable, auditable deployment receipts.
 *
 * ── Setup Arc CLI ─────────────────────────────────────────────────────────────
 *   uv tool install git+https://github.com/the-canteen-dev/ARC-cli
 *   arc-canteen rpc eth_chainId          # verify Arc node is reachable
 *
 * ── Dry run (no broadcast, via Arc node) ─────────────────────────────────────
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $ARC_RPC_URL
 *
 * ── Deploy to Base Sepolia via Arc ───────────────────────────────────────────
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $ARC_RPC_URL \
 *     --broadcast \
 *     --verify \
 *     --etherscan-api-key $BASESCAN_API_KEY
 *
 * ── Deploy to Base Mainnet via Arc ───────────────────────────────────────────
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $ARC_RPC_URL \
 *     --broadcast \
 *     --verify \
 *     --etherscan-api-key $BASESCAN_API_KEY
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY     Private key of the deployer EOA
 *   ARC_RPC_URL              Arc node RPC endpoint (https://arc-node.thecanteenapp.com/)
 *   ARC_API_KEY              Arc API key for authenticated writes
 *   USYC_ADDRESS             USYC token address on target chain
 *   USDC_ADDRESS             USDC token address on target chain
 *                              Base Mainnet: 0x833589fCD6eDb6E08f4cEAA5e9087D3Ef0E2B5B
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
