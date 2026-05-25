// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/TaxeeTypes.sol";
import "../src/TaxeeLotRegistry.sol";
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

/**
 * Deploy all Taxee contracts to Arc testnet (chainId 5042002).
 * Run:
 *   forge script script/Deploy.s.sol:DeployArc \
 *     --rpc-url arc_testnet \
 *     --broadcast \
 *     --private-key $PRIVATE_KEY \
 *     -vvvv
 */
contract DeployArc is Script {
    function run() public {
        address executor = vm.envOr("EXECUTOR_ADDRESS", msg.sender);
        address relayer  = vm.envOr("RELAYER_ADDRESS",  msg.sender);

        vm.startBroadcast();

        console.log("Deploying to Arc Testnet (chainId 5042002)...");
        console.log("Deployer:", msg.sender);

        // 1. TaxeeLotRegistry (used by backend commitDisposal)
        TaxeeLotRegistry registry2 = new TaxeeLotRegistry();
        console.log("TaxeeLotRegistry:", address(registry2));

        // 2. DelegationRegistry (EIP-7702)
        DelegationRegistry delegation = new DelegationRegistry();
        console.log("DelegationRegistry:", address(delegation));

        // 3. TaxeeManager
        TaxeeManager manager = new TaxeeManager(address(delegation));
        console.log("TaxeeManager:", address(manager));

        // 4. Wire up
        delegation.setTaxeeManager(address(manager));
        manager.setAuthorizedExecutor(executor, true);
        manager.setCircleRelayer(relayer);

        // 5. Allowed assets — Arc testnet USDC (bridged via CCTP)
        address usdcArc = vm.envOr("USDC_ADDRESS", address(0));
        manager.setAllowedAsset(address(0), true); // native USDC (gas token on Arc)
        if (usdcArc != address(0)) manager.setAllowedAsset(usdcArc, true);

        manager.setSlippageTolerance(100);
        manager.setRebuyCooldown(300);

        vm.stopBroadcast();

        console.log("\n=== Arc Testnet Deployment ===");
        console.log("TaxeeLotRegistry:   ", address(registry2));
        console.log("DelegationRegistry: ", address(delegation));
        console.log("TaxeeManager:       ", address(manager));
        console.log("==============================");
        console.log("Update .env:");
        console.log("  TAXEE_LOT_REGISTRY_ADDRESS=", address(registry2));
        console.log("  TAXEE_MANAGER_ADDRESS=      ", address(manager));
        console.log("  DELEGATION_REGISTRY_ADDRESS=", address(delegation));

        string memory deploymentJson = string.concat(
            '{\n',
            '  "network": "arc_testnet",\n',
            '  "chainId": 5042002,\n',
            '  "taxeeLotRegistry": "', vm.toString(address(registry2)), '",\n',
            '  "delegationRegistry": "', vm.toString(address(delegation)), '",\n',
            '  "taxeeManager": "', vm.toString(address(manager)), '",\n',
            '  "deployer": "', vm.toString(msg.sender), '",\n',
            '  "timestamp": ', vm.toString(block.timestamp), '\n',
            '}'
        );
        vm.writeFile("deployments/arc_testnet.json", deploymentJson);
    }
}

/**
 * Deploy Taxee contracts to Ethereum Sepolia (chainId 11155111).
 * Run:
 *   forge script script/Deploy.s.sol:DeployEthSepolia \
 *     --rpc-url eth_sepolia \
 *     --broadcast \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     -vvvv
 */
contract DeployEthSepolia is Script {
    function run() public {
        address executor = vm.envOr("EXECUTOR_ADDRESS", msg.sender);

        vm.startBroadcast();

        console.log("Deploying to Ethereum Sepolia (chainId 11155111)...");
        console.log("Deployer / executor:", msg.sender);

        // 1. DelegationRegistry
        DelegationRegistry registry = new DelegationRegistry();
        console.log("DelegationRegistry:", address(registry));

        // 2. TaxeeManager
        TaxeeManager manager = new TaxeeManager(address(registry));
        console.log("TaxeeManager:", address(manager));

        // 3. Wire
        registry.setTaxeeManager(address(manager));
        manager.setAuthorizedExecutor(executor, true);

        // 4. Allowed assets — ETH native + USDC on Eth Sepolia
        address usdcSepolia = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
        address wethSepolia  = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
        manager.setAllowedAsset(address(0),   true); // native ETH
        manager.setAllowedAsset(usdcSepolia,  true); // USDC
        manager.setAllowedAsset(wethSepolia,  true); // WETH (harvest rebuy target)

        manager.setSlippageTolerance(100); // 1%
        manager.setRebuyCooldown(300);     // 5 min

        vm.stopBroadcast();

        console.log("\n=== Eth Sepolia Deployment ===");
        console.log("DelegationRegistry:", address(registry));
        console.log("TaxeeManager:      ", address(manager));
        console.log("Executor:          ", executor);
        console.log("==============================");
        console.log("Add to Railway:");
        console.log("  TAXEE_MANAGER_ADDRESS=      ", address(manager));
        console.log("  DELEGATION_REGISTRY_ADDRESS=", address(registry));

        // Write addresses JSON
        string memory json = string.concat(
            '{\n',
            '  "network": "eth_sepolia",\n',
            '  "chainId": 11155111,\n',
            '  "delegationRegistry": "', vm.toString(address(registry)), '",\n',
            '  "taxeeManager": "', vm.toString(address(manager)), '",\n',
            '  "executor": "', vm.toString(executor), '",\n',
            '  "deployer": "', vm.toString(msg.sender), '",\n',
            '  "timestamp": ', vm.toString(block.timestamp), '\n',
            '}'
        );
        vm.writeFile("deployments/eth_sepolia.json", json);
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
