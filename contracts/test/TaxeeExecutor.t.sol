// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/TaxeeExecutor.sol";
import "../src/TaxeeLotRegistry.sol";
import "../src/interfaces/IERC20.sol";
import "../src/interfaces/IUsyc.sol";

// ─── Mock ERC20 ───────────────────────────────────────────────────────────────

contract MockERC20 is IERC20 {
    string  public name;
    uint8   public decimals;
    uint256 public totalSupply;

    mapping(address => uint256)                     public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, uint8 _decimals) {
        name     = _name;
        decimals = _decimals;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply   += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to]         += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount,              "Insufficient balance");
        require(allowance[from][msg.sender] >= amount,  "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from]             -= amount;
        balanceOf[to]               += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

// ─── Mock USYC (1:1 by default, configurable NAV) ─────────────────────────────

/**
 * @dev MockUsyc supports a configurable NAV multiplier to simulate yield:
 *      - navBps = 10000 → 1:1 (default)
 *      - navBps = 10500 → 1 share redeems 1.05 USDC (5% NAV appreciation)
 */
contract MockUsyc is IUsyc {
    MockERC20 public usdcToken;
    uint256   public navBps = 10_000; // basis points, 10000 = 1:1

    mapping(address => uint256) public balanceOf;
    uint256 public totalAssets;

    constructor(address _usdc) {
        usdcToken = MockERC20(_usdc);
    }

    /// @dev Simulate NAV appreciation (e.g., 10500 = 1.05x)
    function setNav(uint256 _navBps) external {
        navBps = _navBps;
    }

    function asset() external view returns (address) {
        return address(usdcToken);
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        shares = (assets * 10_000) / navBps; // fewer shares if NAV > 1
        usdcToken.transferFrom(msg.sender, address(this), assets);
        balanceOf[receiver] += shares;
        totalAssets         += assets;
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        assets = (shares * navBps) / 10_000; // more USDC if NAV > 1
        require(balanceOf[owner] >= shares, "Insufficient shares");
        balanceOf[owner] -= shares;
        totalAssets       = totalAssets > assets ? totalAssets - assets : 0;
        // Mint extra USDC to vault to simulate yield accrual
        if (assets > usdcToken.balanceOf(address(this))) {
            usdcToken.mint(address(this), assets - usdcToken.balanceOf(address(this)));
        }
        usdcToken.transfer(receiver, assets);
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        return (shares * navBps) / 10_000;
    }

    function previewDeposit(uint256 assets) external pure returns (uint256) {
        return assets;
    }
}

// ─── Main Test Contract ───────────────────────────────────────────────────────

contract TaxeeExecutorTest is Test {
    TaxeeExecutor    public executor;
    TaxeeLotRegistry public registry;
    MockERC20        public usdc;
    MockUsyc         public usyc;

    address public authorizedCaller = makeAddr("circle-wallet");
    address public unauthorized     = makeAddr("random");
    address public agentAddr        = makeAddr("agent");
    address public recipient        = makeAddr("recipient");

    bytes32 public constant LOT_A = keccak256("lot-weth-001");
    bytes32 public constant LOT_B = keccak256("lot-wbtc-002");
    bytes32 public constant LOT_C = keccak256("lot-sol-003");

    uint256 public constant USDC_1000 = 1_000e6;
    uint256 public constant USDC_500  =   500e6;
    uint256 public constant USDC_250  =   250e6;
    uint256 public constant USDC_10K  = 10_000e6;

    function setUp() public {
        usdc     = new MockERC20("USD Coin", 6);
        usyc     = new MockUsyc(address(usdc));
        registry = new TaxeeLotRegistry();

        executor = new TaxeeExecutor(
            address(usyc),
            address(usdc),
            address(registry),
            authorizedCaller
        );

        usdc.mint(authorizedCaller, USDC_10K);
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    function test_constructor_setsImmutables() public {
        assertEq(address(executor.usyc()),            address(usyc));
        assertEq(address(executor.usdc()),            address(usdc));
        assertEq(address(executor.registry()),        address(registry));
        assertEq(executor.authorizedCaller(),         authorizedCaller);
    }

    function test_constructor_reverts_zeroUsyc() public {
        vm.expectRevert("Zero USYC");
        new TaxeeExecutor(address(0), address(usdc), address(registry), authorizedCaller);
    }

    function test_constructor_reverts_zeroUsdc() public {
        vm.expectRevert("Zero USDC");
        new TaxeeExecutor(address(usyc), address(0), address(registry), authorizedCaller);
    }

    function test_constructor_reverts_zeroRegistry() public {
        vm.expectRevert("Zero registry");
        new TaxeeExecutor(address(usyc), address(usdc), address(0), authorizedCaller);
    }

    function test_constructor_reverts_zeroAuthorizedCaller() public {
        vm.expectRevert("Zero caller");
        new TaxeeExecutor(address(usyc), address(usdc), address(registry), address(0));
    }

    // ─── parkInUsyc: happy path ───────────────────────────────────────────────

    function test_parkInUsyc_success() public {
        vm.startPrank(authorizedCaller);
        usdc.approve(address(executor), USDC_1000);
        uint256 shares = executor.parkInUsyc(USDC_1000, LOT_A, agentAddr);
        vm.stopPrank();

        assertEq(shares,                            USDC_1000); // 1:1 default
        assertEq(executor.getParkedShares(LOT_A),  USDC_1000);
        assertEq(executor.previewParkedValue(LOT_A), USDC_1000);
        assertEq(executor.parkedBy(LOT_A),          agentAddr);
    }

    function test_parkInUsyc_emitsEvent() public {
        vm.startPrank(authorizedCaller);
        usdc.approve(address(executor), USDC_1000);

        vm.expectEmit(true, true, false, true);
        emit TaxeeExecutor.ParkedInUsyc(agentAddr, LOT_A, USDC_1000, USDC_1000, block.timestamp);
        executor.parkInUsyc(USDC_1000, LOT_A, agentAddr);
        vm.stopPrank();
    }

    function test_parkInUsyc_accumulates_sameLot() public {
        vm.startPrank(authorizedCaller);
        usdc.approve(address(executor), USDC_1000 * 3);

        executor.parkInUsyc(USDC_1000, LOT_A, agentAddr);
        executor.parkInUsyc(USDC_1000, LOT_A, agentAddr);
        executor.parkInUsyc(USDC_1000, LOT_A, agentAddr);
        vm.stopPrank();

        assertEq(executor.getParkedShares(LOT_A), USDC_1000 * 3);
    }

    function test_parkInUsyc_independentLots_doNotInterfere() public {
        vm.startPrank(authorizedCaller);
        usdc.approve(address(executor), USDC_1000 * 2);

        executor.parkInUsyc(USDC_1000, LOT_A, agentAddr);
        executor.parkInUsyc(USDC_1000, LOT_B, agentAddr);
        vm.stopPrank();

        assertEq(executor.getParkedShares(LOT_A), USDC_1000);
        assertEq(executor.getParkedShares(LOT_B), USDC_1000);
    }

    function test_parkInUsyc_tracksParkedByPerLot() public {
        address agentX = makeAddr("agentX");
        address agentY = makeAddr("agentY");

        vm.startPrank(authorizedCaller);
        usdc.approve(address(executor), USDC_1000 * 2);
        executor.parkInUsyc(USDC_1000, LOT_A, agentX);
        executor.parkInUsyc(USDC_1000, LOT_B, agentY);
        vm.stopPrank();

        assertEq(executor.parkedBy(LOT_A), agentX);
        assertEq(executor.parkedBy(LOT_B), agentY);
    }

    function test_parkInUsyc_transfersUsdcFromCaller() public {
        uint256 callerBefore   = usdc.balanceOf(authorizedCaller);
        uint256 executorBefore = usdc.balanceOf(address(executor));

        vm.startPrank(authorizedCaller);
        usdc.approve(address(executor), USDC_1000);
        executor.parkInUsyc(USDC_1000, LOT_A, agentAddr);
        vm.stopPrank();

        // USDC leaves caller, goes to USYC vault (not stuck in executor)
        assertEq(usdc.balanceOf(authorizedCaller), callerBefore - USDC_1000);
        assertEq(usdc.balanceOf(address(executor)), executorBefore); // executor holds nothing
    }

    // ─── parkInUsyc: reverts ─────────────────────────────────────────────────

    function test_parkInUsyc_reverts_unauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert(TaxeeExecutor.Unauthorized.selector);
        executor.parkInUsyc(USDC_1000, LOT_A, agentAddr);
    }

    function test_parkInUsyc_reverts_zeroAmount() public {
        vm.prank(authorizedCaller);
        vm.expectRevert(TaxeeExecutor.ZeroAmount.selector);
        executor.parkInUsyc(0, LOT_A, agentAddr);
    }

    function test_parkInUsyc_reverts_insufficientAllowance_exact() public {
        vm.startPrank(authorizedCaller);
        usdc.approve(address(executor), USDC_500);
        vm.expectRevert(
            abi.encodeWithSelector(
                TaxeeExecutor.InsufficientAllowance.selector, USDC_1000, USDC_500
            )
        );
        executor.parkInUsyc(USDC_1000, LOT_A, agentAddr);
        vm.stopPrank();
    }

    function test_parkInUsyc_reverts_zeroAllowance() public {
        vm.startPrank(authorizedCaller);
        // no approve call
        vm.expectRevert(
            abi.encodeWithSelector(
                TaxeeExecutor.InsufficientAllowance.selector, USDC_1000, 0
            )
        );
        executor.parkInUsyc(USDC_1000, LOT_A, agentAddr);
        vm.stopPrank();
    }

    // ─── redeemFromUsyc ───────────────────────────────────────────────────────

    function test_redeemFromUsyc_partial() public {
        _park(USDC_1000, LOT_A);

        uint256 recipientBefore = usdc.balanceOf(recipient);

        vm.prank(authorizedCaller);
        uint256 redeemed = executor.redeemFromUsyc(USDC_500, LOT_A, recipient);

        assertEq(redeemed,                          USDC_500);
        assertEq(usdc.balanceOf(recipient),         recipientBefore + USDC_500);
        assertEq(executor.getParkedShares(LOT_A),  USDC_500); // half still parked
    }

    function test_redeemFromUsyc_full_inOneCall() public {
        _park(USDC_1000, LOT_A);

        vm.prank(authorizedCaller);
        executor.redeemFromUsyc(USDC_1000, LOT_A, recipient);

        assertEq(executor.getParkedShares(LOT_A), 0);
        assertEq(executor.previewParkedValue(LOT_A), 0);
    }

    function test_redeemFromUsyc_multiplePartials_drainToZero() public {
        _park(USDC_1000, LOT_A);

        vm.startPrank(authorizedCaller);
        executor.redeemFromUsyc(USDC_250, LOT_A, recipient);
        executor.redeemFromUsyc(USDC_250, LOT_A, recipient);
        executor.redeemFromUsyc(USDC_250, LOT_A, recipient);
        executor.redeemFromUsyc(USDC_250, LOT_A, recipient);
        vm.stopPrank();

        assertEq(executor.getParkedShares(LOT_A), 0);
        assertEq(usdc.balanceOf(recipient), USDC_1000);
    }

    function test_redeemFromUsyc_emitsEvent() public {
        _park(USDC_1000, LOT_A);

        vm.prank(authorizedCaller);
        vm.expectEmit(true, true, false, true);
        emit TaxeeExecutor.RedeemedFromUsyc(agentAddr, LOT_A, USDC_500, USDC_500, block.timestamp);
        executor.redeemFromUsyc(USDC_500, LOT_A, recipient);
    }

    function test_redeemFromUsyc_doesNotAffectOtherLots() public {
        _park(USDC_1000, LOT_A);
        _park(USDC_1000, LOT_B);

        vm.prank(authorizedCaller);
        executor.redeemFromUsyc(USDC_1000, LOT_A, recipient);

        assertEq(executor.getParkedShares(LOT_A), 0);
        assertEq(executor.getParkedShares(LOT_B), USDC_1000); // untouched
    }

    function test_redeemFromUsyc_reverts_noSharesParked() public {
        vm.prank(authorizedCaller);
        vm.expectRevert(
            abi.encodeWithSelector(TaxeeExecutor.NoSharesParked.selector, LOT_B)
        );
        executor.redeemFromUsyc(USDC_500, LOT_B, recipient);
    }

    function test_redeemFromUsyc_reverts_insufficientShares() public {
        _park(USDC_500, LOT_A);

        vm.prank(authorizedCaller);
        vm.expectRevert(
            abi.encodeWithSelector(
                TaxeeExecutor.InsufficientShares.selector, LOT_A, USDC_1000, USDC_500
            )
        );
        executor.redeemFromUsyc(USDC_1000, LOT_A, recipient);
    }

    function test_redeemFromUsyc_reverts_zeroAmount() public {
        _park(USDC_1000, LOT_A);

        vm.prank(authorizedCaller);
        vm.expectRevert(TaxeeExecutor.ZeroAmount.selector);
        executor.redeemFromUsyc(0, LOT_A, recipient);
    }

    function test_redeemFromUsyc_reverts_unauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert(TaxeeExecutor.Unauthorized.selector);
        executor.redeemFromUsyc(USDC_500, LOT_A, recipient);
    }

    // ─── redeemAllForLot ──────────────────────────────────────────────────────

    function test_redeemAllForLot_success() public {
        _park(USDC_1000, LOT_A);

        vm.prank(authorizedCaller);
        uint256 returned = executor.redeemAllForLot(LOT_A, recipient);

        assertEq(returned,                          USDC_1000);
        assertEq(executor.getParkedShares(LOT_A),  0);
        assertEq(executor.previewParkedValue(LOT_A), 0);
        assertEq(usdc.balanceOf(recipient),         USDC_1000);
    }

    function test_redeemAllForLot_emitsEvent() public {
        _park(USDC_1000, LOT_A);

        vm.prank(authorizedCaller);
        vm.expectEmit(true, true, false, true);
        emit TaxeeExecutor.RedeemedFromUsyc(agentAddr, LOT_A, USDC_1000, USDC_1000, block.timestamp);
        executor.redeemAllForLot(LOT_A, recipient);
    }

    function test_redeemAllForLot_reverts_noSharesParked() public {
        vm.prank(authorizedCaller);
        vm.expectRevert(
            abi.encodeWithSelector(TaxeeExecutor.NoSharesParked.selector, LOT_A)
        );
        executor.redeemAllForLot(LOT_A, recipient);
    }

    function test_redeemAllForLot_reverts_unauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert(TaxeeExecutor.Unauthorized.selector);
        executor.redeemAllForLot(LOT_A, recipient);
    }

    // ─── previewParkedValue ───────────────────────────────────────────────────

    function test_previewParkedValue_zero_whenNothingParked() public {
        assertEq(executor.previewParkedValue(LOT_A), 0);
    }

    function test_previewParkedValue_reflects_navAppreciation() public {
        _park(USDC_1000, LOT_A);

        // Simulate 5% NAV appreciation
        usyc.setNav(10_500);

        uint256 value = executor.previewParkedValue(LOT_A);
        assertEq(value, (USDC_1000 * 10_500) / 10_000); // 1050 USDC
    }

    function test_previewParkedValue_afterPartialRedeem() public {
        _park(USDC_1000, LOT_A);

        vm.prank(authorizedCaller);
        executor.redeemFromUsyc(USDC_500, LOT_A, recipient);

        assertEq(executor.previewParkedValue(LOT_A), USDC_500);
    }

    // ─── NAV appreciation round-trip ──────────────────────────────────────────

    function test_navAppreciation_userReceivesMoreOnRedeem() public {
        _park(USDC_1000, LOT_A);

        // 10% yield accrues while parked
        usyc.setNav(11_000);

        vm.prank(authorizedCaller);
        uint256 returned = executor.redeemAllForLot(LOT_A, recipient);

        // User gets 1100 USDC back for 1000 parked
        assertEq(returned, (USDC_1000 * 11_000) / 10_000);
        assertGt(returned, USDC_1000);
    }

    // ─── park → redeem → park again (re-use same lot) ─────────────────────────

    function test_rePark_afterFullRedeem() public {
        _park(USDC_1000, LOT_A);

        vm.prank(authorizedCaller);
        executor.redeemAllForLot(LOT_A, authorizedCaller);

        assertEq(executor.getParkedShares(LOT_A), 0);

        // Park again — same lotId should work fine
        _park(USDC_500, LOT_A);
        assertEq(executor.getParkedShares(LOT_A), USDC_500);
    }

    // ─── Multi-lot accounting ─────────────────────────────────────────────────

    function test_multiLot_independentBalances() public {
        _park(USDC_1000, LOT_A);
        _park(USDC_500,  LOT_B);
        _park(USDC_250,  LOT_C);

        assertEq(executor.getParkedShares(LOT_A), USDC_1000);
        assertEq(executor.getParkedShares(LOT_B), USDC_500);
        assertEq(executor.getParkedShares(LOT_C), USDC_250);

        vm.prank(authorizedCaller);
        executor.redeemAllForLot(LOT_B, recipient);

        assertEq(executor.getParkedShares(LOT_A), USDC_1000); // unchanged
        assertEq(executor.getParkedShares(LOT_B), 0);          // drained
        assertEq(executor.getParkedShares(LOT_C), USDC_250);  // unchanged
    }

    // ─── getParkedShares view ────────────────────────────────────────────────

    function test_getParkedShares_returnsZero_forUnknownLot() public {
        assertEq(executor.getParkedShares(bytes32(uint256(9999))), 0);
    }

    // ─── Fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_parkAndRedeemAll_roundTrip(uint96 amount) public {
        vm.assume(amount > 0 && uint256(amount) <= 1_000_000e6);

        usdc.mint(authorizedCaller, amount);
        _parkAmount(amount, LOT_A);

        uint256 recipientBefore = usdc.balanceOf(recipient);

        vm.prank(authorizedCaller);
        executor.redeemAllForLot(LOT_A, recipient);

        assertEq(usdc.balanceOf(recipient), recipientBefore + amount); // 1:1 mock
        assertEq(executor.getParkedShares(LOT_A), 0);
    }

    function testFuzz_partialRedeems_sumToFull(uint96 amount, uint96 partialA, uint96 partialB) public {
        vm.assume(amount  > 0 && uint256(amount) <= 1_000_000e6);
        vm.assume(uint256(partialA) + uint256(partialB) <= uint256(amount));
        vm.assume(partialA > 0 && partialB > 0);

        usdc.mint(authorizedCaller, amount);
        _parkAmount(amount, LOT_A);

        vm.startPrank(authorizedCaller);
        executor.redeemFromUsyc(partialA, LOT_A, recipient);
        executor.redeemFromUsyc(partialB, LOT_A, recipient);
        vm.stopPrank();

        uint256 remaining = uint256(amount) - uint256(partialA) - uint256(partialB);
        assertEq(executor.getParkedShares(LOT_A), remaining);
    }

    function testFuzz_unauthorizedAlwaysReverts(address caller) public {
        vm.assume(caller != authorizedCaller);

        vm.prank(caller);
        vm.expectRevert(TaxeeExecutor.Unauthorized.selector);
        executor.parkInUsyc(USDC_1000, LOT_A, agentAddr);

        vm.prank(caller);
        vm.expectRevert(TaxeeExecutor.Unauthorized.selector);
        executor.redeemFromUsyc(USDC_500, LOT_A, caller);

        vm.prank(caller);
        vm.expectRevert(TaxeeExecutor.Unauthorized.selector);
        executor.redeemAllForLot(LOT_A, caller);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function _park(uint256 amount, bytes32 lotId) internal {
        vm.startPrank(authorizedCaller);
        usdc.approve(address(executor), amount);
        executor.parkInUsyc(amount, lotId, agentAddr);
        vm.stopPrank();
    }

    function _parkAmount(uint256 amount, bytes32 lotId) internal {
        vm.startPrank(authorizedCaller);
        usdc.approve(address(executor), amount);
        executor.parkInUsyc(amount, lotId, agentAddr);
        vm.stopPrank();
    }
}
