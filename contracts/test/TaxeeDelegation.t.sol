// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TaxeeTypes.sol";
import "../src/DelegationRegistry.sol";
import "../src/TaxeeManager.sol";

contract TaxeeDelegationTest is Test {
    DelegationRegistry public registry;
    TaxeeManager public manager;
    
    address public owner = address(1);
    address public user = address(2);
    address public executor = address(3);
    address public relayer = address(4);
    address public unauthorized = address(5);
    
    uint256 constant INITIAL_BALANCE = 100 ether;
    uint256 constant ONE_DAY = 86400;
    uint256 constant ONE_MONTH = 30 days;
    
    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy contracts
        registry = new DelegationRegistry();
        manager = new TaxeeManager(address(registry));
        
        // Set up roles
        registry.setTaxeeManager(address(manager));
        manager.setAuthorizedExecutor(executor, true);
        manager.setCircleRelayer(relayer);
        
        vm.stopPrank();
        
        // Fund user
        vm.deal(user, INITIAL_BALANCE);
    }
    
    // ============ Delegation Creation Tests ============
    
    function test_CreateDelegation() public {
        vm.startPrank(user);
        
        TaxeeTypes.Delegation memory delegation = TaxeeTypes.Delegation({
            delegate: address(manager),
            policyHash: keccak256("test-policy"),
            expiration: block.timestamp + 90 days,
            maxPerTx: 5_000 ether, // $5,000
            maxPerMonth: 20_000 ether, // $20,000
            isActive: true,
            createdAt: 0,
            signature: ""
        });
        
        registry.createDelegation(delegation);
        
        (bool hasDelegation, uint256 expiration) = registry.hasActiveDelegation(user);
        assertTrue(hasDelegation);
        assertEq(expiration, block.timestamp + 90 days);
        
        vm.stopPrank();
    }
    
    function test_RevertCreateDelegation_ZeroDelegate() public {
        vm.startPrank(user);
        
        TaxeeTypes.Delegation memory delegation = TaxeeTypes.Delegation({
            delegate: address(0),
            policyHash: keccak256("test-policy"),
            expiration: block.timestamp + 90 days,
            maxPerTx: 5_000 ether,
            maxPerMonth: 20_000 ether,
            isActive: true,
            createdAt: 0,
            signature: ""
        });
        
        vm.expectRevert(DelegationRegistry.ZeroAddress.selector);
        registry.createDelegation(delegation);
        
        vm.stopPrank();
    }
    
    function test_RevertCreateDelegation_Expired() public {
        vm.startPrank(user);
        
        TaxeeTypes.Delegation memory delegation = TaxeeTypes.Delegation({
            delegate: address(manager),
            policyHash: keccak256("test-policy"),
            expiration: block.timestamp - 1,
            maxPerTx: 5_000 ether,
            maxPerMonth: 20_000 ether,
            isActive: true,
            createdAt: 0,
            signature: ""
        });
        
        vm.expectRevert(DelegationRegistry.PolicyViolation.selector);
        registry.createDelegation(delegation);
        
        vm.stopPrank();
    }
    
    function test_RevertCreateDelegation_ZeroLimits() public {
        vm.startPrank(user);
        
        TaxeeTypes.Delegation memory delegation = TaxeeTypes.Delegation({
            delegate: address(manager),
            policyHash: keccak256("test-policy"),
            expiration: block.timestamp + 90 days,
            maxPerTx: 0,
            maxPerMonth: 20_000 ether,
            isActive: true,
            createdAt: 0,
            signature: ""
        });
        
        vm.expectRevert(DelegationRegistry.PolicyViolation.selector);
        registry.createDelegation(delegation);
        
        vm.stopPrank();
    }
    
    function test_RevertCreateDelegation_TxExceedsMonthly() public {
        vm.startPrank(user);
        
        TaxeeTypes.Delegation memory delegation = TaxeeTypes.Delegation({
            delegate: address(manager),
            policyHash: keccak256("test-policy"),
            expiration: block.timestamp + 90 days,
            maxPerTx: 25_000 ether, // Exceeds monthly
            maxPerMonth: 20_000 ether,
            isActive: true,
            createdAt: 0,
            signature: ""
        });
        
        vm.expectRevert(DelegationRegistry.PolicyViolation.selector);
        registry.createDelegation(delegation);
        
        vm.stopPrank();
    }
    
    // ============ Delegation Revocation Tests ============
    
    function test_RevokeDelegation() public {
        // Create delegation first
        vm.startPrank(user);
        
        TaxeeTypes.Delegation memory delegation = TaxeeTypes.Delegation({
            delegate: address(manager),
            policyHash: keccak256("test-policy"),
            expiration: block.timestamp + 90 days,
            maxPerTx: 5_000 ether,
            maxPerMonth: 20_000 ether,
            isActive: true,
            createdAt: 0,
            signature: ""
        });
        
        registry.createDelegation(delegation);
        
        // Revoke it
        registry.revokeDelegation();
        
        (bool hasDelegation, ) = registry.hasActiveDelegation(user);
        assertFalse(hasDelegation);
        
        vm.stopPrank();
    }
    
    function test_RevertRevoke_NoDelegation() public {
        vm.startPrank(user);
        
        vm.expectRevert(DelegationRegistry.DelegationNotFound.selector);
        registry.revokeDelegation();
        
        vm.stopPrank();
    }
    
    // ============ Monthly Limit Tests ============
    
    function test_MonthlyLimitTracking() public {
        // Create delegation
        vm.startPrank(user);
        
        TaxeeTypes.Delegation memory delegation = TaxeeTypes.Delegation({
            delegate: address(manager),
            policyHash: keccak256("test-policy"),
            expiration: block.timestamp + 90 days,
            maxPerTx: 5_000 ether,
            maxPerMonth: 10_000 ether,
            isActive: true,
            createdAt: 0,
            signature: ""
        });
        
        registry.createDelegation(delegation);
        vm.stopPrank();
        
        // Use 3,000 of 10,000 monthly limit
        vm.prank(address(manager));
        registry.validateAndRecordUsage(user, 3_000 ether, TaxeeTypes.ActionType.HARVEST);
        
        (uint256 remaining, ) = registry.getRemainingMonthlyLimit(user);
        assertEq(remaining, 7_000 ether);
        
        // Use another 4,000
        vm.prank(address(manager));
        registry.validateAndRecordUsage(user, 4_000 ether, TaxeeTypes.ActionType.HARVEST);
        
        (remaining, ) = registry.getRemainingMonthlyLimit(user);
        assertEq(remaining, 3_000 ether);
    }
    
    function test_RevertMonthlyLimit_Exceeded() public {
        // Create delegation with 10k monthly limit
        vm.startPrank(user);
        
        TaxeeTypes.Delegation memory delegation = TaxeeTypes.Delegation({
            delegate: address(manager),
            policyHash: keccak256("test-policy"),
            expiration: block.timestamp + 90 days,
            maxPerTx: 5_000 ether,
            maxPerMonth: 10_000 ether,
            isActive: true,
            createdAt: 0,
            signature: ""
        });
        
        registry.createDelegation(delegation);
        vm.stopPrank();
        
        // Use 8,000
        vm.prank(address(manager));
        registry.validateAndRecordUsage(user, 8_000 ether, TaxeeTypes.ActionType.HARVEST);
        
        // Try to use another 3,000 (would exceed 10k limit)
        vm.prank(address(manager));
        vm.expectRevert(DelegationRegistry.MonthlyLimitExceeded.selector);
        registry.validateAndRecordUsage(user, 3_000 ether, TaxeeTypes.ActionType.HARVEST);
    }
    
    function test_MonthlyLimit_Reset() public {
        // Create delegation
        vm.startPrank(user);
        
        TaxeeTypes.Delegation memory delegation = TaxeeTypes.Delegation({
            delegate: address(manager),
            policyHash: keccak256("test-policy"),
            expiration: block.timestamp + 90 days,
            maxPerTx: 5_000 ether,
            maxPerMonth: 10_000 ether,
            isActive: true,
            createdAt: 0,
            signature: ""
        });
        
        registry.createDelegation(delegation);
        vm.stopPrank();
        
        // Use full limit
        vm.prank(address(manager));
        registry.validateAndRecordUsage(user, 10_000 ether, TaxeeTypes.ActionType.HARVEST);
        
        // Fast forward 30 days
        vm.warp(block.timestamp + 31 days);
        
        // Should reset to full limit
        (uint256 remaining, ) = registry.getRemainingMonthlyLimit(user);
        assertEq(remaining, 10_000 ether);
    }
    
    // ============ TaxeeManager Tests ============
    
    function test_ExecuteHarvest() public {
        // Setup delegation
        vm.startPrank(user);
        TaxeeTypes.Delegation memory delegation = TaxeeTypes.Delegation({
            delegate: address(manager),
            policyHash: keccak256("test-policy"),
            expiration: block.timestamp + 90 days,
            maxPerTx: 5_000 ether,
            maxPerMonth: 20_000 ether,
            isActive: true,
            createdAt: 0,
            signature: ""
        });
        registry.createDelegation(delegation);
        vm.stopPrank();
        
        address eth = 0x0000000000000000000000000000000000000000;
        
        // Execute harvest
        vm.prank(executor);
        bytes32 requestId = manager.executeHarvest(
            user,
            eth,
            0.8 ether,
            2_320 ether,
            "lot-3"
        );
        
        assertTrue(requestId != bytes32(0));
    }
    
    function test_RevertExecute_UnauthorizedExecutor() public {
        address eth = 0x0000000000000000000000000000000000000000;
        
        vm.prank(unauthorized);
        vm.expectRevert();
        manager.executeHarvest(user, eth, 0.8 ether, 2_320 ether, "lot-3");
    }
    
    function test_RevertExecute_NoDelegation() public {
        address eth = 0x0000000000000000000000000000000000000000;
        
        // User doesn't have delegation
        vm.prank(executor);
        // This will fail when trying to validate in DelegationRegistry
        vm.expectRevert();
        manager.executeHarvest(unauthorized, eth, 0.8 ether, 2_320 ether, "lot-3");
    }
    
    function test_ConfirmExecution() public {
        // Setup and create request
        vm.startPrank(user);
        TaxeeTypes.Delegation memory delegation = TaxeeTypes.Delegation({
            delegate: address(manager),
            policyHash: keccak256("test-policy"),
            expiration: block.timestamp + 90 days,
            maxPerTx: 5_000 ether,
            maxPerMonth: 20_000 ether,
            isActive: true,
            createdAt: 0,
            signature: ""
        });
        registry.createDelegation(delegation);
        vm.stopPrank();
        
        address eth = 0x0000000000000000000000000000000000000000;
        
        vm.prank(executor);
        bytes32 requestId = manager.executeHarvest(user, eth, 0.8 ether, 2_320 ether, "lot-3");
        
        // Confirm execution as relayer
        vm.prank(relayer);
        manager.confirmExecution(requestId, bytes32("tx-hash"), 2_320 ether, true);
        
        // Request should be deleted
        TaxeeTypes.TransactionPayload memory pending = manager.getPendingExecution(requestId);
        assertEq(pending.deadline, 0);
    }
    
    function test_RevertConfirm_SlippageExceeded() public {
        // Setup and create request with 2,320 estimated
        vm.startPrank(user);
        TaxeeTypes.Delegation memory delegation = TaxeeTypes.Delegation({
            delegate: address(manager),
            policyHash: keccak256("test-policy"),
            expiration: block.timestamp + 90 days,
            maxPerTx: 5_000 ether,
            maxPerMonth: 20_000 ether,
            isActive: true,
            createdAt: 0,
            signature: ""
        });
        registry.createDelegation(delegation);
        vm.stopPrank();
        
        address eth = 0x0000000000000000000000000000000000000000;
        
        vm.prank(executor);
        bytes32 requestId = manager.executeHarvest(user, eth, 0.8 ether, 2_320 ether, "lot-3");
        
        // Try to confirm with 10% less (exceeds 1% tolerance)
        vm.prank(relayer);
        vm.expectRevert(TaxeeManager.SlippageExceeded.selector);
        manager.confirmExecution(requestId, bytes32("tx-hash"), 2_088 ether, true); // 10% less
    }
    
    function test_CanExecuteCheck() public {
        vm.startPrank(user);
        TaxeeTypes.Delegation memory delegation = TaxeeTypes.Delegation({
            delegate: address(manager),
            policyHash: keccak256("test-policy"),
            expiration: block.timestamp + 90 days,
            maxPerTx: 5_000 ether,
            maxPerMonth: 20_000 ether,
            isActive: true,
            createdAt: 0,
            signature: ""
        });
        registry.createDelegation(delegation);
        vm.stopPrank();
        
        address eth = 0x0000000000000000000000000000000000000000;
        
        (bool canExecute, ) = manager.canExecute(user, TaxeeTypes.ActionType.HARVEST, eth, 1_000 ether);
        assertTrue(canExecute);
        
        // Test with unauthorized asset
        address randomAsset = address(0x123);
        (canExecute, ) = manager.canExecute(user, TaxeeTypes.ActionType.HARVEST, randomAsset, 1_000 ether);
        assertFalse(canExecute);
    }
    
    function test_SkipOpportunity() public {
        // Setup
        vm.startPrank(user);
        TaxeeTypes.Delegation memory delegation = TaxeeTypes.Delegation({
            delegate: address(manager),
            policyHash: keccak256("test-policy"),
            expiration: block.timestamp + 90 days,
            maxPerTx: 5_000 ether,
            maxPerMonth: 20_000 ether,
            isActive: true,
            createdAt: 0,
            signature: ""
        });
        registry.createDelegation(delegation);
        vm.stopPrank();
        
        address eth = 0x0000000000000000000000000000000000000000;
        
        vm.prank(executor);
        bytes32 requestId = manager.executeHarvest(user, eth, 0.8 ether, 2_320 ether, "lot-3");
        
        // Skip it
        vm.prank(executor);
        manager.skipOpportunity(requestId, "Price moved unfavorably");
        
        // Should be deleted
        TaxeeTypes.TransactionPayload memory pending = manager.getPendingExecution(requestId);
        assertEq(pending.deadline, 0);
    }
}
