// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/TaxeeExecutor.sol";
import "../src/TaxeeLotRegistry.sol";
import "../src/interfaces/IERC20.sol";
import "../src/interfaces/IUsyc.sol";

// ─── Mock Contracts ───────────────────────────────────────────────────────────

contract MockERC20 is IERC20 {
    string public name;
    uint8  public decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
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
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from]             -= amount;
        balanceOf[to]               += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

/**
 * @dev Simple mock USYC: 1:1 with USDC for test simplicity.
 *      In production, shares appreciate vs assets over time.
 */
contract MockUsyc is IUsyc {
    MockERC20 public usdcToken;
    mapping(address => uint256) public balanceOf;
    uint256 public totalAssets;

    constructor(address _usdc) {
        usdcToken = MockERC20(_usdc);
    }

    function asset() external view returns (address) {
        return address(usdcToken);
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        shares = assets; // 1:1 for tests
        usdcToken.transferFrom(msg.sender, address(this), assets);
        balanceOf[receiver] += shares;
        totalAssets         += assets;
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        assets = shares; // 1:1 for tests
        require(balanceOf[owner] >= shares, "Insufficient shares");
        balanceOf[owner] -= shares;
        totalAssets      -= assets;
        usdcToken.transfer(receiver, assets);
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function previewRedeem(uint256 shares) external pure returns (uint256) {
        return shares;
    }

    function previewDeposit(uint256 assets) external pure returns (uint256) {
        return assets;
    }
}

// ─── Test Contract ────────────────────────────────────────────────────────────

contract TaxeeExecutorTest is Test {
    TaxeeExecutor    public executor;
    TaxeeLotRegistry public registry;
    MockERC20        public usdc;
    MockUsyc         public usyc;

    address public authorizedCaller = makeAddr("circle-wallet");
    address public unauthorized     = makeAddr("random");
    address public agentAddr        = makeAddr("agent");

    bytes32 public constant LOT_A = keccak256("lot-weth-001");
    bytes32 public constant LOT_B = keccak256("lot-wbtc-002");

    uint256 public constant USDC_1000 = 1000e6;  // 1000 USDC (6 decimals)
    uint256 public constant USDC_500  = 500e6;

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

        // Fund the authorized caller with USDC
        usdc.mint(authorizedCaller, 10_000e6);
    }

    // ─── parkInUsyc ───────────────────────────────────────────────────────────

    function test_parkInUsyc_success() public {
        vm.startPrank(authorizedCaller);
        usdc.approve(address(executor), USDC_1000);
        uint256 shares = executor.parkInUsyc(USDC_1000, LOT_A, agentAddr);
        vm.stopPrank();

        assertEq(shares, USDC_1000); // 1:1 mock
        assertEq(executor.getParkedShares(LOT_A), USDC_1000);
        assertEq(executor.previewParkedValue(LOT_A), USDC_1000);
    }

    function test_parkInUsyc_emitsEvent() public {
        vm.startPrank(authorizedCaller);
        usdc.approve(address(executor), USDC_1000);

        vm.expectEmit(true, true, false, true);
        emit TaxeeExecutor.ParkedInUsyc(agentAddr, LOT_A, USDC_1000, USDC_1000, block.timestamp);
        executor.parkInUsyc(USDC_1000, LOT_A, agentAddr);
        vm.stopPrank();
    }

    function test_parkInUsyc_accumulates_multiplePark() public {
        vm.startPrank(authorizedCaller);
        usdc.approve(address(executor), USDC_1000 * 2);

        executor.parkInUsyc(USDC_1000, LOT_A, agentAddr);
        executor.parkInUsyc(USDC_1000, LOT_A, agentAddr);
        vm.stopPrank();

        assertEq(executor.getParkedShares(LOT_A), USDC_1000 * 2);
    }

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

    function test_parkInUsyc_reverts_insufficientAllowance() public {
        vm.startPrank(authorizedCaller);
        usdc.approve(address(executor), USDC_500); // only approve 500, try to park 1000
        vm.expectRevert(
            abi.encodeWithSelector(TaxeeExecutor.InsufficientAllowance.selector, USDC_1000, USDC_500)
        );
        executor.parkInUsyc(USDC_1000, LOT_A, agentAddr);
        vm.stopPrank();
    }

    // ─── redeemFromUsyc ───────────────────────────────────────────────────────

    function test_redeemFromUsyc_success() public {
        vm.startPrank(authorizedCaller);
        usdc.approve(address(executor), USDC_1000);
        executor.parkInUsyc(USDC_1000, LOT_A, agentAddr);

        uint256 usdcBefore = usdc.balanceOf(authorizedCaller);
        uint256 redeemed   = executor.redeemFromUsyc(USDC_500, LOT_A, authorizedCaller);
        vm.stopPrank();

        assertEq(redeemed, USDC_500);
        assertEq(usdc.balanceOf(authorizedCaller), usdcBefore + USDC_500);
        assertEq(executor.getParkedShares(LOT_A), USDC_500); // 500 still parked
    }

    function test_redeemAllForLot_success() public {
        vm.startPrank(authorizedCaller);
        usdc.approve(address(executor), USDC_1000);
        executor.parkInUsyc(USDC_1000, LOT_A, agentAddr);

        executor.redeemAllForLot(LOT_A, authorizedCaller);
        vm.stopPrank();

        assertEq(executor.getParkedShares(LOT_A), 0);
        assertEq(executor.previewParkedValue(LOT_A), 0);
    }

    function test_redeemFromUsyc_reverts_noSharesParked() public {
        vm.prank(authorizedCaller);
        vm.expectRevert(abi.encodeWithSelector(TaxeeExecutor.NoSharesParked.selector, LOT_B));
        executor.redeemFromUsyc(USDC_500, LOT_B, authorizedCaller);
    }

    function test_redeemFromUsyc_reverts_insufficientShares() public {
        vm.startPrank(authorizedCaller);
        usdc.approve(address(executor), USDC_500);
        executor.parkInUsyc(USDC_500, LOT_A, agentAddr); // park 500

        vm.expectRevert(
            abi.encodeWithSelector(TaxeeExecutor.InsufficientShares.selector, LOT_A, USDC_1000, USDC_500)
        );
        executor.redeemFromUsyc(USDC_1000, LOT_A, authorizedCaller); // try to redeem 1000
        vm.stopPrank();
    }

    function test_redeemFromUsyc_reverts_unauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert(TaxeeExecutor.Unauthorized.selector);
        executor.redeemFromUsyc(USDC_500, LOT_A, unauthorized);
    }

    // ─── Fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_parkAndRedeem(uint96 amount) public {
        vm.assume(amount > 0 && amount <= 1_000_000e6);

        usdc.mint(authorizedCaller, amount);

        vm.startPrank(authorizedCaller);
        usdc.approve(address(executor), amount);
        executor.parkInUsyc(amount, LOT_A, agentAddr);

        uint256 usdcBefore = usdc.balanceOf(authorizedCaller);
        executor.redeemAllForLot(LOT_A, authorizedCaller);
        vm.stopPrank();

        // Full round-trip: user gets back what they put in (1:1 mock)
        assertEq(usdc.balanceOf(authorizedCaller), usdcBefore + amount);
        assertEq(executor.getParkedShares(LOT_A), 0);
    }
}
