// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/TaxeeTypes.sol";
import "../src/DelegationRegistry.sol";
import "../src/TaxeeManager.sol";

contract Deploy is Script {
    function setUp() public {}

    function run() public {
        // Get deployment parameters from environment
        address executor = vm.envOr("EXECUTOR_ADDRESS", address(0));
        address relayer = vm.envOr("RELAYER_ADDRESS", address(0));
        
        vm.startBroadcast();

        console.log("Deploying Taxee Contracts...");
        console.log("Deployer:", msg.sender);

        // 1. Deploy DelegationRegistry
        DelegationRegistry registry = new DelegationRegistry();
        console.log("DelegationRegistry deployed at:", address(registry));

        // 2. Deploy TaxeeManager
        TaxeeManager manager = new TaxeeManager(address(registry));
        console.log("TaxeeManager deployed at:", address(manager));

        // 3. Set TaxeeManager in registry
        registry.setTaxeeManager(address(manager));
        console.log("TaxeeManager set in DelegationRegistry");

        // 4. Configure authorized executor if provided
        if (executor != address(0)) {
            manager.setAuthorizedExecutor(executor, true);
            console.log("Executor authorized:", executor);
        }

        // 5. Configure Circle relayer if provided
        if (relayer != address(0)) {
            manager.setCircleRelayer(relayer);
            console.log("Circle relayer set:", relayer);
        }

        // 6. Configure allowed assets (Base mainnet addresses)
        // USDC on Base
        address usdcBase = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
        // USYC (Circle Yield Token) - placeholder, update with real address
        address usycBase = vm.envOr("USYC_ADDRESS", address(0));
        
        manager.setAllowedAsset(address(0), true); // ETH
        manager.setAllowedAsset(usdcBase, true);
        console.log("ETH and USDC configured as allowed assets");
        
        if (usycBase != address(0)) {
            manager.setAllowedAsset(usycBase, true);
            manager.setUsycToken(usycBase);
            console.log("USYC configured:", usycBase);
        }

        // 7. Set initial parameters
        manager.setSlippageTolerance(100); // 1%
        manager.setRebuyCooldown(300);     // 5 minutes
        console.log("Parameters configured: 1% slippage, 5min cooldown");

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("Network:", block.chainid);
        console.log("DelegationRegistry:", address(registry));
        console.log("TaxeeManager:", address(manager));
        console.log("==========================\n");

        // Write addresses to file for frontend
        string memory deploymentJson = string.concat(
            '{\n',
            '  "network": "', vm.toString(block.chainid), '",\n',
            '  "delegationRegistry": "', vm.toString(address(registry)), '",\n',
            '  "taxeeManager": "', vm.toString(address(manager)), '",\n',
            '  "deployer": "', vm.toString(msg.sender), '",\n',
            '  "timestamp": ', vm.toString(block.timestamp), '\n',
            '}'
        );

        vm.writeFile(
            string.concat("deployments/", vm.toString(block.chainid), ".json"),
            deploymentJson
        );
    }
}

contract DeployTestnet is Script {
    function run() public {
        // Use Base Sepolia testnet addresses
        address executor = vm.envOr("EXECUTOR_ADDRESS", msg.sender);
        address relayer = vm.envOr("RELAYER_ADDRESS", msg.sender);
        
        vm.startBroadcast();

        console.log("Deploying to Base Sepolia Testnet...");

        // Deploy contracts
        DelegationRegistry registry = new DelegationRegistry();
        TaxeeManager manager = new TaxeeManager(address(registry));
        
        // Configure
        registry.setTaxeeManager(address(manager));
        manager.setAuthorizedExecutor(executor, true);
        manager.setCircleRelayer(relayer);
        
        // Testnet USDC on Base Sepolia
        address usdcSepolia = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
        manager.setAllowedAsset(address(0), true); // ETH
        manager.setAllowedAsset(usdcSepolia, true);
        
        manager.setSlippageTolerance(100);
        manager.setRebuyCooldown(300);

        vm.stopBroadcast();

        console.log("DelegationRegistry:", address(registry));
        console.log("TaxeeManager:", address(manager));
    }
}
