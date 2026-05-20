// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/TaxeeLotRegistry.sol";

contract TaxeeLotRegistryTest is Test {
    TaxeeLotRegistry public registry;

    address public agent1 = makeAddr("agent1");
    address public agent2 = makeAddr("agent2");

    bytes32 public constant LOT_A = keccak256("lot-weth-001");
    bytes32 public constant LOT_B = keccak256("lot-wbtc-002");
    bytes32 public constant LOT_C = keccak256("lot-sol-003");

    bytes32 public constant HASH_A = keccak256(abi.encode("arc-record-A"));
    bytes32 public constant HASH_B = keccak256(abi.encode("arc-record-B"));
    bytes32 public constant HASH_C = keccak256(abi.encode("arc-record-C"));

    function setUp() public {
        registry = new TaxeeLotRegistry();
    }

    // ─── commitDisposal ────────────────────────────────────────────────────────

    function test_commitDisposal_success() public {
        vm.prank(agent1);
        registry.commitDisposal(LOT_A, HASH_A);

        (bytes32 storedHash, address storedAgent,, bool exists) = registry.getCommitment(LOT_A);

        assertEq(storedHash, HASH_A);
        assertEq(storedAgent, agent1);
        assertTrue(exists);
        assertEq(registry.totalDisposals(), 1);
    }

    function test_commitDisposal_emitsEvent() public {
        vm.prank(agent1);
        vm.expectEmit(true, true, true, true);
        emit TaxeeLotRegistry.LotDisposed(agent1, LOT_A, HASH_A, block.timestamp);
        registry.commitDisposal(LOT_A, HASH_A);
    }

    function test_commitDisposal_reverts_ifAlreadyCommitted() public {
        vm.prank(agent1);
        registry.commitDisposal(LOT_A, HASH_A);

        vm.prank(agent2);
        vm.expectRevert(abi.encodeWithSelector(TaxeeLotRegistry.LotAlreadyCommitted.selector, LOT_A));
        registry.commitDisposal(LOT_A, HASH_B);
    }

    function test_commitDisposal_reverts_onZeroHash() public {
        vm.prank(agent1);
        vm.expectRevert(TaxeeLotRegistry.InvalidHash.selector);
        registry.commitDisposal(LOT_A, bytes32(0));
    }

    function test_commitDisposal_differentAgents_differentLots() public {
        vm.prank(agent1);
        registry.commitDisposal(LOT_A, HASH_A);

        vm.prank(agent2);
        registry.commitDisposal(LOT_B, HASH_B);

        assertEq(registry.totalDisposals(), 2);
        (, address agentA,,) = registry.getCommitment(LOT_A);
        (, address agentB,,) = registry.getCommitment(LOT_B);
        assertEq(agentA, agent1);
        assertEq(agentB, agent2);
    }

    // ─── commitDisposalBatch ───────────────────────────────────────────────────

    function test_batchCommit_success() public {
        bytes32[] memory lotIds    = new bytes32[](3);
        bytes32[] memory dataHashes = new bytes32[](3);

        lotIds[0] = LOT_A; dataHashes[0] = HASH_A;
        lotIds[1] = LOT_B; dataHashes[1] = HASH_B;
        lotIds[2] = LOT_C; dataHashes[2] = HASH_C;

        vm.prank(agent1);
        registry.commitDisposalBatch(lotIds, dataHashes);

        assertEq(registry.totalDisposals(), 3);
        assertTrue(registry.isCommitted(LOT_A));
        assertTrue(registry.isCommitted(LOT_B));
        assertTrue(registry.isCommitted(LOT_C));
    }

    function test_batchCommit_reverts_onLengthMismatch() public {
        bytes32[] memory lotIds    = new bytes32[](2);
        bytes32[] memory dataHashes = new bytes32[](3);

        lotIds[0] = LOT_A; lotIds[1] = LOT_B;
        dataHashes[0] = HASH_A; dataHashes[1] = HASH_B; dataHashes[2] = HASH_C;

        vm.prank(agent1);
        vm.expectRevert("Length mismatch");
        registry.commitDisposalBatch(lotIds, dataHashes);
    }

    function test_batchCommit_reverts_onDuplicate() public {
        bytes32[] memory lotIds    = new bytes32[](2);
        bytes32[] memory dataHashes = new bytes32[](2);
        lotIds[0] = LOT_A; dataHashes[0] = HASH_A;
        lotIds[1] = LOT_A; dataHashes[1] = HASH_B; // duplicate

        vm.prank(agent1);
        vm.expectRevert(abi.encodeWithSelector(TaxeeLotRegistry.LotAlreadyCommitted.selector, LOT_A));
        registry.commitDisposalBatch(lotIds, dataHashes);
    }

    // ─── verifyDisposal ────────────────────────────────────────────────────────

    function test_verifyDisposal_true_onMatch() public {
        vm.prank(agent1);
        registry.commitDisposal(LOT_A, HASH_A);
        assertTrue(registry.verifyDisposal(LOT_A, HASH_A));
    }

    function test_verifyDisposal_false_onWrongHash() public {
        vm.prank(agent1);
        registry.commitDisposal(LOT_A, HASH_A);
        assertFalse(registry.verifyDisposal(LOT_A, HASH_B));
    }

    function test_verifyDisposal_false_onUnknownLot() public {
        assertFalse(registry.verifyDisposal(LOT_A, HASH_A));
    }

    // ─── isCommitted ──────────────────────────────────────────────────────────

    function test_isCommitted_false_beforeCommit() public {
        assertFalse(registry.isCommitted(LOT_A));
    }

    function test_isCommitted_true_afterCommit() public {
        vm.prank(agent1);
        registry.commitDisposal(LOT_A, HASH_A);
        assertTrue(registry.isCommitted(LOT_A));
    }

    // ─── Fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_commitDisposal(bytes32 lotId, bytes32 dataHash) public {
        vm.assume(lotId != bytes32(0));
        vm.assume(dataHash != bytes32(0));

        vm.prank(agent1);
        registry.commitDisposal(lotId, dataHash);

        assertTrue(registry.verifyDisposal(lotId, dataHash));
        assertTrue(registry.isCommitted(lotId));
    }
}
