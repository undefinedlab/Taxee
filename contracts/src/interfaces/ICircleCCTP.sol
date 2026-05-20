// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITokenMessenger
 * @notice Circle CCTP v1 TokenMessenger interface.
 *         Used by TaxeeExecutor to bridge USDC cross-chain for harvest settlement.
 * @dev    Source: https://developers.circle.com/cctp/v1/evm-smart-contracts
 *
 *         ── Mainnet ──────────────────────────────────────────────────────────
 *         Ethereum:     0xBd3fa81B58Ba92a82136038B25aDec7066af3155
 *         Base:         0x1682Ae6375C4E4A97e4B583BC394c861A46D8962  ← primary
 *         Arbitrum:     0x19330d10D9Cc8751218eaf51E8885D058642E08A
 *         Optimism:     0x2B4069517957735bE00ceE0fadAE88a26365528f
 *         Polygon:      0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE
 *
 *         ── Testnet ──────────────────────────────────────────────────────────
 *         Base Sepolia: 0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5
 *         Eth Sepolia:  0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5
 */
interface ITokenMessenger {
    /**
     * @notice Deposits and burns USDC to initiate a cross-chain transfer.
     * @param  amount             Amount of USDC to burn (6 decimals)
     * @param  destinationDomain  Destination chain domain ID (Base = 6, Ethereum = 0, Arbitrum = 3)
     * @param  mintRecipient      Recipient address on destination chain (as bytes32, left-padded)
     * @param  burnToken          USDC contract address on the source chain
     * @return nonce              Unique nonce for this transfer (used to retrieve attestation)
     */
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken
    ) external returns (uint64 nonce);

    /**
     * @notice Deposits and burns USDC with a custom caller restriction on the destination.
     */
    function depositForBurnWithCaller(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller
    ) external returns (uint64 nonce);
}

/**
 * @title IMessageTransmitter
 * @notice Circle CCTP v1 MessageTransmitter interface.
 *         Used to receive and finalize cross-chain USDC mints on the destination chain.
 * @dev    ── Mainnet ──────────────────────────────────────────────────────────
 *         Ethereum:     0x0a992d191DEeC32aFe36203Ad87D7d289a738F81
 *         Base:         0xAD09780d193884d503182aD4588450C416D6F9D4  ← primary
 *         Arbitrum:     0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca
 *         Optimism:     0x4D41f22c5a0e5c74090899E5a8Fb597a8842b3e8
 *         Polygon:      0xF3be9355363857F3e001be68856A2f96b4C39Ba9
 *
 *         ── Testnet ──────────────────────────────────────────────────────────
 *         Base Sepolia: 0x7865fAfC2db2093669d92c0F33AeEF291086BEFD
 *         Eth Sepolia:  0x7865fAfC2db2093669d92c0F33AeEF291086BEFD
 */
interface IMessageTransmitter {
    /**
     * @notice Receives a message and attestation from Circle's off-chain attestation service.
     * @param  message      The message bytes emitted by TokenMessenger on source chain
     * @param  attestation  Circle's off-chain ECDSA attestation over the message hash
     * @return success      True if the message was received and USDC minted
     */
    function receiveMessage(
        bytes calldata message,
        bytes calldata attestation
    ) external returns (bool success);
}

/**
 * @title CCTPAddresses
 * @notice Canonical CCTP V1 contract addresses used by Taxee.
 *         Primary deployment is Base mainnet (chainId 8453).
 *         Swap to *_TESTNET constants for Base Sepolia (chainId 84532).
 */
library CCTPAddresses {
    // ── Base Mainnet (chainId 8453) ──────────────────────────────────────────
    address internal constant TOKEN_MESSENGER      = 0x1682Ae6375C4E4A97e4B583BC394c861A46D8962;
    address internal constant MESSAGE_TRANSMITTER  = 0xAD09780d193884d503182aD4588450C416D6F9D4;
    address internal constant TOKEN_MINTER         = 0xe45B133ddc64bE80252b0e9c75A8E74EF280eEd6;

    // ── Base Sepolia (chainId 84532) ─────────────────────────────────────────
    address internal constant TOKEN_MESSENGER_TESTNET     = 0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5;
    address internal constant MESSAGE_TRANSMITTER_TESTNET = 0x7865fAfC2db2093669d92c0F33AeEF291086BEFD;
    address internal constant TOKEN_MINTER_TESTNET        = 0xE997d7d2F6E065a9A93Fa2175E878Fb9081F1f0A;

    // ── CCTP Domain IDs ──────────────────────────────────────────────────────
    uint32 internal constant DOMAIN_ETHEREUM = 0;
    uint32 internal constant DOMAIN_AVALANCHE = 1;
    uint32 internal constant DOMAIN_OPTIMISM  = 2;
    uint32 internal constant DOMAIN_ARBITRUM  = 3;
    uint32 internal constant DOMAIN_BASE      = 6;
    uint32 internal constant DOMAIN_POLYGON   = 7;
}
