// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/TaxeeLotRegistry.sol";

// ─── Invariant Handler ────────────────────────────────────────────────────────

contract RegistryHandler is Test {
    TaxeeLotRegistry public registry;

    uint256 public committedCount;
    bytes32[] public committedLots;

    constructor(TaxeeLotRegistry _registry) {
        registry = _registry;
    }

    function commitRandom(bytes32 lotId, bytes32 dataHash) external {
        if (lotId == bytes32(0) || dataHash == bytes32(0)) return;
        if (registry.isCommitted(lotId)) return;

        registry.commitDisposal(lotId, dataHash);
        committedLots.push(lotId);
        committedCount++;
    }

    function committedLotsLength() external view returns (uint256) {
        return committedLots.length;
    }
}

// ─── Main Test Contract ───────────────────────────────────────────────────────

contract TaxeeLotRegistryTest is Test {
    TaxeeLotRegistry public registry;
    RegistryHandler  public handler;

    address public agent1 = makeAddr("agent1");
    address public agent2 = makeAddr("agent2");
    address public agent3 = makeAddr("agent3");

    bytes32 public constant LOT_A = keccak256("lot-weth-001");
    bytes32 public constant LOT_B = keccak256("lot-wbtc-002");
    bytes32 public constant LOT_C = keccak256("lot-sol-003");
    bytes32 public constant LOT_D = keccak256("lot-link-004");

    bytes32 public constant HASH_A = keccak256(abi.encode("arc-record-A"));
    bytes32 public constant HASH_B = keccak256(abi.encode("arc-record-B"));
    bytes32 public constant HASH_C = keccak256(abi.encode("arc-record-C"));
    bytes32 public constant HASH_D = keccak256(abi.encode("arc-record-D"));

    function setUp() public {
        registry = new TaxeeLotRegistry();
        handler  = new RegistryHandler(registry);
        targetContract(address(handler));
    }

    // ─── commitDisposal: happy path ───────────────────────────────────────────

    function test_commitDisposal_success() public {
        vm.prank(agent1);
        registry.commitDisposal(LOT_A, HASH_A);

        (bytes32 storedHash, address storedAgent, uint256 blk, bool exists) =
            registry.getCommitment(LOT_A);

        assertEq(storedHash,    HASH_A);
        assertEq(storedAgent,   agent1);
        assertEq(blk,           block.number);
        assertTrue(exists);
        assertEq(registry.totalDisposals(), 1);
    }

    function test_commitDisposal_storesBlockNumber() public {
        vm.roll(999);
        vm.prank(agent1);
        registry.commitDisposal(LOT_A, HASH_A);

        (,, uint256 blk,) = registry.getCommitment(LOT_A);
        assertEq(blk, 999);
    }

    function test_commitDisposal_emitsEvent() public {
        vm.prank(agent1);
        vm.expectEmit(true, true, true, true);
        emit TaxeeLotRegistry.LotDisposed(agent1, LOT_A, HASH_A, block.timestamp);
        registry.commitDisposal(LOT_A, HASH_A);
    }

    function test_commitDisposal_differentAgents_differentLots() public {
        vm.prank(agent1); registry.commitDisposal(LOT_A, HASH_A);
        vm.prank(agent2); registry.commitDisposal(LOT_B, HASH_B);
        vm.prank(agent3); registry.commitDisposal(LOT_C, HASH_C);

        assertEq(registry.totalDisposals(), 3);

        (, address a,,) = registry.getCommitment(LOT_A);
        (, address b,,) = registry.getCommitment(LOT_B);
        (, address c,,) = registry.getCommitment(LOT_C);

        assertEq(a, agent1);
        assertEq(b, agent2);
        assertEq(c, agent3);
    }

    function test_commitDisposal_sameAgentMultipleLots() public {
        vm.startPrank(agent1);
        registry.commitDisposal(LOT_A, HASH_A);
        registry.commitDisposal(LOT_B, HASH_B);
        registry.commitDisposal(LOT_C, HASH_C);
        vm.stopPrank();

        assertEq(registry.totalDisposals(), 3);
        assertTrue(registry.isCommitted(LOT_A));
        assertTrue(registry.isCommitted(LOT_B));
        assertTrue(registry.isCommitted(LOT_C));
    }

    function test_commitDisposal_publicMapping_accessible() public {
        vm.prank(agent1);
        registry.commitDisposal(LOT_A, HASH_A);

        assertEq(registry.lotHashes(LOT_A),  HASH_A);
        assertEq(registry.lotAgents(LOT_A),  agent1);
        assertEq(registry.lotBlocks(LOT_A),  block.number);
    }

    // ─── commitDisposal: reverts ──────────────────────────────────────────────

    function test_commitDisposal_reverts_ifAlreadyCommitted_sameAgent() public {
        vm.startPrank(agent1);
        registry.commitDisposal(LOT_A, HASH_A);

        vm.expectRevert(
            abi.encodeWithSelector(TaxeeLotRegistry.LotAlreadyCommitted.selector, LOT_A)
        );
        registry.commitDisposal(LOT_A, HASH_B);
        vm.stopPrank();
    }

    function test_commitDisposal_reverts_ifAlreadyCommitted_differentAgent() public {
        vm.prank(agent1);
        registry.commitDisposal(LOT_A, HASH_A);

        vm.prank(agent2);
        vm.expectRevert(
            abi.encodeWithSelector(TaxeeLotRegistry.LotAlreadyCommitted.selector, LOT_A)
        );
        registry.commitDisposal(LOT_A, HASH_B);
    }

    function test_commitDisposal_reverts_onZeroHash() public {
        vm.prank(agent1);
        vm.expectRevert(TaxeeLotRegistry.InvalidHash.selector);
        registry.commitDisposal(LOT_A, bytes32(0));
    }

    function test_commitDisposal_reverts_doesNotIncrementCount_onRevert() public {
        vm.prank(agent1);
        registry.commitDisposal(LOT_A, HASH_A);

        vm.prank(agent2);
        try registry.commitDisposal(LOT_A, HASH_B) {} catch {}

        assertEq(registry.totalDisposals(), 1); // still 1
    }

    // ─── commitDisposalBatch ──────────────────────────────────────────────────

    function test_batchCommit_success_3lots() public {
        (bytes32[] memory ids, bytes32[] memory hashes) = _makeBatch3();

        vm.prank(agent1);
        registry.commitDisposalBatch(ids, hashes);

        assertEq(registry.totalDisposals(), 3);
        assertTrue(registry.isCommitted(LOT_A));
        assertTrue(registry.isCommitted(LOT_B));
        assertTrue(registry.isCommitted(LOT_C));
    }

    function test_batchCommit_success_singleElement() public {
        bytes32[] memory ids    = new bytes32[](1);
        bytes32[] memory hashes = new bytes32[](1);
        ids[0] = LOT_A; hashes[0] = HASH_A;

        vm.prank(agent1);
        registry.commitDisposalBatch(ids, hashes);

        assertEq(registry.totalDisposals(), 1);
        assertTrue(registry.isCommitted(LOT_A));
    }

    function test_batchCommit_emitsEventsForEachLot() public {
        (bytes32[] memory ids, bytes32[] memory hashes) = _makeBatch3();

        vm.prank(agent1);
        vm.expectEmit(true, true, true, false);
        emit TaxeeLotRegistry.LotDisposed(agent1, LOT_A, HASH_A, block.timestamp);
        vm.expectEmit(true, true, true, false);
        emit TaxeeLotRegistry.LotDisposed(agent1, LOT_B, HASH_B, block.timestamp);
        vm.expectEmit(true, true, true, false);
        emit TaxeeLotRegistry.LotDisposed(agent1, LOT_C, HASH_C, block.timestamp);

        registry.commitDisposalBatch(ids, hashes);
    }

    function test_batchCommit_reverts_onLengthMismatch_moreLots() public {
        bytes32[] memory ids    = new bytes32[](3);
        bytes32[] memory hashes = new bytes32[](2);

        vm.prank(agent1);
        vm.expectRevert("Length mismatch");
        registry.commitDisposalBatch(ids, hashes);
    }

    function test_batchCommit_reverts_onLengthMismatch_moreHashes() public {
        bytes32[] memory ids    = new bytes32[](2);
        bytes32[] memory hashes = new bytes32[](3);

        vm.prank(agent1);
        vm.expectRevert("Length mismatch");
        registry.commitDisposalBatch(ids, hashes);
    }

    function test_batchCommit_reverts_emptyBatch() public {
        bytes32[] memory ids    = new bytes32[](0);
        bytes32[] memory hashes = new bytes32[](0);

        vm.prank(agent1);
        vm.expectRevert("Empty batch");
        registry.commitDisposalBatch(ids, hashes);
    }

    function test_batchCommit_reverts_onDuplicateWithinBatch() public {
        bytes32[] memory ids    = new bytes32[](2);
        bytes32[] memory hashes = new bytes32[](2);
        ids[0] = LOT_A; hashes[0] = HASH_A;
        ids[1] = LOT_A; hashes[1] = HASH_B; // same lotId twice

        vm.prank(agent1);
        vm.expectRevert(
            abi.encodeWithSelector(TaxeeLotRegistry.LotAlreadyCommitted.selector, LOT_A)
        );
        registry.commitDisposalBatch(ids, hashes);
    }

    function test_batchCommit_reverts_onZeroHashInMiddle() public {
        bytes32[] memory ids    = new bytes32[](3);
        bytes32[] memory hashes = new bytes32[](3);
        ids[0] = LOT_A; hashes[0] = HASH_A;
        ids[1] = LOT_B; hashes[1] = bytes32(0); // zero hash in middle
        ids[2] = LOT_C; hashes[2] = HASH_C;

        vm.prank(agent1);
        vm.expectRevert(TaxeeLotRegistry.InvalidHash.selector);
        registry.commitDisposalBatch(ids, hashes);

        // Atomicity: nothing was committed because revert undoes everything
        assertFalse(registry.isCommitted(LOT_A));
        assertEq(registry.totalDisposals(), 0);
    }

    function test_batchCommit_atomicity_onDuplicate_alreadyCommitted() public {
        vm.prank(agent1);
        registry.commitDisposal(LOT_B, HASH_B); // pre-commit LOT_B

        bytes32[] memory ids    = new bytes32[](3);
        bytes32[] memory hashes = new bytes32[](3);
        ids[0] = LOT_A; hashes[0] = HASH_A;
        ids[1] = LOT_B; hashes[1] = HASH_C; // already committed
        ids[2] = LOT_C; hashes[2] = HASH_C;

        vm.prank(agent2);
        vm.expectRevert(
            abi.encodeWithSelector(TaxeeLotRegistry.LotAlreadyCommitted.selector, LOT_B)
        );
        registry.commitDisposalBatch(ids, hashes);

        // LOT_A must NOT have been committed (batch reverted atomically)
        assertFalse(registry.isCommitted(LOT_A));
        assertEq(registry.totalDisposals(), 1); // only the original LOT_B
    }

    // ─── verifyDisposal ───────────────────────────────────────────────────────

    function test_verifyDisposal_true_onExactMatch() public {
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

    function test_verifyDisposal_false_onZeroHashQuery() public {
        vm.prank(agent1);
        registry.commitDisposal(LOT_A, HASH_A);
        assertFalse(registry.verifyDisposal(LOT_A, bytes32(0)));
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

    function test_isCommitted_false_forZeroLotId() public {
        assertFalse(registry.isCommitted(bytes32(0)));
    }

    // ─── getCommitment ────────────────────────────────────────────────────────

    function test_getCommitment_returnsZeros_forUnknownLot() public {
        (bytes32 h, address a, uint256 blk, bool exists) = registry.getCommitment(LOT_A);
        assertEq(h,    bytes32(0));
        assertEq(a,    address(0));
        assertEq(blk,  0);
        assertFalse(exists);
    }

    function test_getCommitment_allFields_correct() public {
        vm.roll(42);
        vm.prank(agent1);
        registry.commitDisposal(LOT_A, HASH_A);

        (bytes32 h, address a, uint256 blk, bool exists) = registry.getCommitment(LOT_A);
        assertEq(h,    HASH_A);
        assertEq(a,    agent1);
        assertEq(blk,  42);
        assertTrue(exists);
    }

    // ─── Immutability guarantee ───────────────────────────────────────────────

    function test_immutability_hashCannotChange_afterCommit() public {
        vm.prank(agent1);
        registry.commitDisposal(LOT_A, HASH_A);

        // Any attempt to overwrite must revert
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(agent2);
            vm.expectRevert(
                abi.encodeWithSelector(TaxeeLotRegistry.LotAlreadyCommitted.selector, LOT_A)
            );
            registry.commitDisposal(LOT_A, bytes32(uint256(i + 1)));
        }

        // Value is unchanged
        (bytes32 h,,,) = registry.getCommitment(LOT_A);
        assertEq(h, HASH_A);
    }

    // ─── Invariant: totalDisposals == number of committed lots ────────────────

    function invariant_totalDisposals_matchesCommittedCount() public {
        assertEq(registry.totalDisposals(), handler.committedCount());
    }

    function invariant_committedLots_alwaysVerify() public {
        uint256 len = handler.committedLotsLength();
        for (uint256 i = 0; i < len; i++) {
            assertTrue(registry.isCommitted(handler.committedLots(i)));
        }
    }

    // ─── Fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_commitDisposal_anyValidInputs(
        bytes32 lotId,
        bytes32 dataHash,
        address caller
    ) public {
        vm.assume(lotId    != bytes32(0));
        vm.assume(dataHash != bytes32(0));
        vm.assume(caller   != address(0));

        vm.prank(caller);
        registry.commitDisposal(lotId, dataHash);

        assertTrue(registry.verifyDisposal(lotId, dataHash));
        assertTrue(registry.isCommitted(lotId));
        assertEq(registry.totalDisposals(), 1);

        (bytes32 h, address a,, bool exists) = registry.getCommitment(lotId);
        assertEq(h, dataHash);
        assertEq(a, caller);
        assertTrue(exists);
    }

    function testFuzz_doubleCommit_alwaysReverts(bytes32 lotId, bytes32 h1, bytes32 h2) public {
        vm.assume(lotId != bytes32(0));
        vm.assume(h1    != bytes32(0));
        vm.assume(h2    != bytes32(0));

        vm.prank(agent1);
        registry.commitDisposal(lotId, h1);

        vm.prank(agent2);
        vm.expectRevert(
            abi.encodeWithSelector(TaxeeLotRegistry.LotAlreadyCommitted.selector, lotId)
        );
        registry.commitDisposal(lotId, h2);
    }

    function testFuzz_batchCommit_countAccumulates(uint8 n) public {
        n = uint8(bound(n, 1, 20));

        bytes32[] memory ids    = new bytes32[](n);
        bytes32[] memory hashes = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) {
            ids[i]    = keccak256(abi.encodePacked("lot", i));
            hashes[i] = keccak256(abi.encodePacked("hash", i));
        }

        vm.prank(agent1);
        registry.commitDisposalBatch(ids, hashes);

        assertEq(registry.totalDisposals(), n);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function _makeBatch3()
        internal
        pure
        returns (bytes32[] memory ids, bytes32[] memory hashes)
    {
        ids    = new bytes32[](3);
        hashes = new bytes32[](3);
        ids[0] = LOT_A; hashes[0] = HASH_A;
        ids[1] = LOT_B; hashes[1] = HASH_B;
        ids[2] = LOT_C; hashes[2] = HASH_C;
    }
}
