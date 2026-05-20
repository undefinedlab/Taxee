// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IUsyc
 * @notice Interface for the USYC token (Hashnote US Yield Coin) on Base.
 *         USYC is a yield-bearing stablecoin backed by US Treasury bills.
 *         taxee parks capital approaching the 365-day long-term threshold here
 *         to earn yield while the lot matures — rather than disposing prematurely.
 * @dev    Base mainnet: verify address via https://basescan.org before production deploy.
 *         USYC uses an ERC-4626-style vault interface.
 */
interface IUsyc {
    /**
     * @notice Deposit USDC and receive USYC shares.
     * @param  assets  Amount of USDC to deposit (6 decimals)
     * @param  receiver Address to mint USYC shares to
     * @return shares  USYC shares minted
     */
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);

    /**
     * @notice Redeem USYC shares back for USDC.
     * @param  shares   Amount of USYC shares to redeem
     * @param  receiver Address to send USDC to
     * @param  owner    Owner of the shares
     * @return assets   USDC returned
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) external returns (uint256 assets);

    /**
     * @notice Preview how much USDC would be returned for a given share amount.
     * @param  shares  USYC share amount
     * @return assets  Estimated USDC return (reflects current NAV)
     */
    function previewRedeem(uint256 shares) external view returns (uint256 assets);

    /**
     * @notice Preview how many USYC shares would be minted for a given USDC deposit.
     */
    function previewDeposit(uint256 assets) external view returns (uint256 shares);

    /**
     * @notice USYC share balance of an account.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @notice Total USDC assets held by the vault.
     */
    function totalAssets() external view returns (uint256);

    /**
     * @notice Underlying asset address (USDC on Base).
     */
    function asset() external view returns (address);

    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
}
