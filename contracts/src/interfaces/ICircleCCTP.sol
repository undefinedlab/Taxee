// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITokenMessenger
 * @notice Circle CCTP v1 TokenMessenger interface.
 *         Used by TaxeeExecutor to bridge USDC cross-chain for harvest settlement.
 * @dev    Deployed addresses: https://developers.circle.com/stablecoins/docs/cctp-protocol-contract
 *         Ethereum:     0xBd3fa81B58Ba92a82136038B25aDec7066af3155
 *         Base:         0x1682Ae6375C4E4A97e4B583BC394c861A46D8962
 *         Arbitrum:     0x19330d10D9Cc8751218eaf51E8885D058642E08A
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
