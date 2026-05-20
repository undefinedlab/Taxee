// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  TaxeeLotRegistry
 * @notice Immutable on-chain registry of tax lot disposal commitments.
 *
 *         Every time taxee executes a disposal (harvest or rebalance), the backend
 *         calls `commitDisposal` to stamp a keccak256 hash of the full Arc record
 *         (lot ID, cost basis, proceeds, gain/loss, timestamp) onto Base.
 *
 *         This gives users a non-repudiable, publicly verifiable anchor for their
 *         Form 8949 data — the Arc off-chain ledger is the source of truth, and
 *         the onchain hash proves it has not been altered after the fact.
 *
 * @dev    Deployed on Base (primary execution chain).
 *         Called by the taxee execution layer (Circle Programmable Wallet authorized caller).
 *         Each lot ID can only be committed once — disposals are permanent.
 */
contract TaxeeLotRegistry {
    // ─── Events ────────────────────────────────────────────────────────────────

    /**
     * @notice Emitted on every disposal commitment.
     * @param  agent      The taxee agent address (keccak256 of agentId from backend)
     * @param  lotId      The taxee lot identifier (keccak256 of lot UUID from backend)
     * @param  dataHash   keccak256(abi.encode(ArcRecord)) — fingerprint of the disposal record
     * @param  timestamp  Block timestamp at commitment
     */
    event LotDisposed(
        address indexed agent,
        bytes32 indexed lotId,
        bytes32 indexed dataHash,
        uint256 timestamp
    );

    // ─── Storage ───────────────────────────────────────────────────────────────

    /// @notice Maps lotId → committed data hash. Zero value = not yet committed.
    mapping(bytes32 => bytes32) public lotHashes;

    /// @notice Maps lotId → committing agent address.
    mapping(bytes32 => address) public lotAgents;

    /// @notice Maps lotId → block number of commitment (for indexing + audit).
    mapping(bytes32 => uint256) public lotBlocks;

    /// @notice Total number of disposal commitments recorded.
    uint256 public totalDisposals;

    // ─── Errors ────────────────────────────────────────────────────────────────

    error LotAlreadyCommitted(bytes32 lotId);
    error InvalidHash();
    error ZeroAgent();

    // ─── Core Functions ────────────────────────────────────────────────────────

    /**
     * @notice Commit a disposal record for a tax lot.
     *         Can only be called once per lotId — disposals are immutable.
     *
     * @param  lotId     keccak256(abi.encodePacked(agentId, lotUUID)) — unique lot identifier
     * @param  dataHash  keccak256(abi.encode(arcRecord)) — hash of the full disposal record
     *
     * @dev    The caller (msg.sender) is recorded as the committing agent.
     *         In production, this should be the Circle Programmable Wallet address
     *         associated with the user's taxee agent.
     */
    function commitDisposal(bytes32 lotId, bytes32 dataHash) external {
        if (lotHashes[lotId] != bytes32(0)) revert LotAlreadyCommitted(lotId);
        if (dataHash == bytes32(0)) revert InvalidHash();
        if (msg.sender == address(0)) revert ZeroAgent();

        lotHashes[lotId]  = dataHash;
        lotAgents[lotId]  = msg.sender;
        lotBlocks[lotId]  = block.number;
        totalDisposals   += 1;

        emit LotDisposed(msg.sender, lotId, dataHash, block.timestamp);
    }

    /**
     * @notice Batch commit multiple disposals in a single transaction.
     *         Gas-efficient for rebalances that touch multiple lots.
     *
     * @param  lotIds    Array of lot identifiers
     * @param  dataHashes Array of corresponding data hashes (must match length)
     */
    function commitDisposalBatch(
        bytes32[] calldata lotIds,
        bytes32[] calldata dataHashes
    ) external {
        require(lotIds.length == dataHashes.length, "Length mismatch");
        require(lotIds.length > 0, "Empty batch");

        for (uint256 i = 0; i < lotIds.length; i++) {
            bytes32 lotId    = lotIds[i];
            bytes32 dataHash = dataHashes[i];

            if (lotHashes[lotId] != bytes32(0)) revert LotAlreadyCommitted(lotId);
            if (dataHash == bytes32(0)) revert InvalidHash();

            lotHashes[lotId] = dataHash;
            lotAgents[lotId] = msg.sender;
            lotBlocks[lotId] = block.number;

            emit LotDisposed(msg.sender, lotId, dataHash, block.timestamp);
        }

        totalDisposals += lotIds.length;
    }

    // ─── View Functions ────────────────────────────────────────────────────────

    /**
     * @notice Verify that a disposal record matches what was committed on-chain.
     * @param  lotId     The lot identifier to check
     * @param  dataHash  The data hash to verify against the committed value
     * @return valid     True if the hash matches the committed value
     */
    function verifyDisposal(bytes32 lotId, bytes32 dataHash) external view returns (bool valid) {
        return lotHashes[lotId] != bytes32(0) && lotHashes[lotId] == dataHash;
    }

    /**
     * @notice Check whether a lot has been committed.
     */
    function isCommitted(bytes32 lotId) external view returns (bool) {
        return lotHashes[lotId] != bytes32(0);
    }

    /**
     * @notice Return full commitment details for a lot.
     */
    function getCommitment(bytes32 lotId)
        external
        view
        returns (
            bytes32 dataHash,
            address agent,
            uint256 blockNumber,
            bool exists
        )
    {
        dataHash    = lotHashes[lotId];
        agent       = lotAgents[lotId];
        blockNumber = lotBlocks[lotId];
        exists      = dataHash != bytes32(0);
    }
}
