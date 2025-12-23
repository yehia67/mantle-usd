// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "src/SuperStake.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockMUSD is ERC20, IMUSD {
    using SafeERC20 for IERC20;

    IERC20 public override collateralAsset;
    uint256 public override mintPercentageBps = 5_000;
    uint256 public override collateralPriceUsd = 4_000e18;
    mapping(address => uint256) public override collateralBalances;
    mapping(address => uint256) public override debtBalances;

    constructor(IERC20 collateral) ERC20("Mock mUSD", "mUSD") {
        collateralAsset = collateral;
    }

    function lockCollateral(uint256 amount) external override {
        collateralAsset.safeTransferFrom(msg.sender, address(this), amount);
        collateralBalances[msg.sender] += amount;
        uint256 debt = _calcDebt(amount);
        debtBalances[msg.sender] += debt;
        _mint(msg.sender, debt);
    }

    function unlockCollateral(uint256 amount) external override {
        uint256 debt = _calcDebt(amount);
        collateralBalances[msg.sender] -= amount;
        debtBalances[msg.sender] -= debt;
        _burn(msg.sender, debt);
        collateralAsset.safeTransfer(msg.sender, amount);
    }

    function _calcDebt(uint256 amount) internal view returns (uint256) {
        return ((amount * collateralPriceUsd) / 1e18) * mintPercentageBps / 10_000;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockSwapper is ISwapper {
    using SafeERC20 for IERC20;

    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes calldata)
        external
        returns (uint256 amountOut)
    {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(msg.sender, amountIn);
        require(amountIn >= minAmountOut, "slippage");
        return amountIn;
    }
}

contract TestSuperStake is Test {
    using SafeERC20 for IERC20;

    SuperStake internal stake;
    MockERC20 internal mEth;
    MockMUSD internal mUsd;
    MockSwapper internal swapper;

    address internal constant USER = address(0xBEEF);
    uint256 internal constant COLLATERAL_PRICE = 4_000e18;
    uint256 internal constant MINT_PERCENTAGE = 5_000; // 50%

    function setUp() public {
        mEth = new MockERC20("Mantle Ether", "mETH");
        swapper = new MockSwapper();
        mUsd = new MockMUSD(mEth);
        stake = new SuperStake();

        stake.setTokens(address(mUsd), address(mEth));
        stake.setSwapper(address(swapper));

        mEth.mint(USER, 100 ether);
        mEth.mint(address(swapper), 1_000_000_000_000 ether);
        mUsd.mint(address(swapper), 1_000_000_000_000 ether);
    }

    function testDepositMinLeverage() public {
        uint256 depositAmount = 10 ether;

        vm.startPrank(USER);
        mEth.approve(address(stake), depositAmount);
        (uint256 collateralLocked, uint256 debtMinted) = stake.deposit(depositAmount, 1, "");
        vm.stopPrank();

        assertTrue(collateralLocked > depositAmount, "collateral increased with 1 loop");
        assertTrue(debtMinted > _expectedDebt(depositAmount), "debt increased with 1 loop");

        SuperStake.Position memory pos = stake.getPosition(USER);
        assertEq(pos.collateralLocked, collateralLocked, "position collateral");
        assertEq(pos.debtMUSD, debtMinted, "position debt");
    }

    function testDepositWithLeverage() public {
        uint256 depositAmount = 1 ether;

        vm.startPrank(USER);
        mEth.approve(address(stake), type(uint256).max);
        (uint256 collateralLocked, uint256 debtMinted) = stake.deposit(depositAmount, 2, "");
        vm.stopPrank();

        SuperStake.Position memory pos = stake.getPosition(USER);

        uint256 singleLoopDebt = _expectedDebt(depositAmount);
        assertTrue(pos.collateralLocked > depositAmount, "leverage increased collateral");
        assertTrue(pos.debtMUSD > singleLoopDebt, "leverage increased debt");
    }

    function testExceedsMaxLoopsReverts() public {
        uint256 depositAmount = 5 ether;

        vm.startPrank(USER);
        mEth.approve(address(stake), type(uint256).max);
        vm.expectRevert("loops must be between 1 and max");
        stake.deposit(depositAmount, 4, "");
        vm.stopPrank();
    }

    function testZeroLoopsReverts() public {
        uint256 depositAmount = 5 ether;

        vm.startPrank(USER);
        mEth.approve(address(stake), type(uint256).max);
        vm.expectRevert("loops must be between 1 and max");
        stake.deposit(depositAmount, 0, "");
        vm.stopPrank();
    }

    function testWithdraw() public {
        uint256 depositAmount = 5 ether;

        vm.startPrank(USER);
        mEth.approve(address(stake), depositAmount);
        stake.deposit(depositAmount, 1, "");
        vm.stopPrank();

        SuperStake.Position memory pos = stake.getPosition(USER);
        uint256 debtToBurn = pos.debtMUSD;

        mUsd.mint(USER, debtToBurn);

        vm.startPrank(USER);
        mUsd.approve(address(stake), debtToBurn);
        uint256 musdReturned = stake.withdraw(pos.collateralLocked, "");
        vm.stopPrank();

        pos = stake.getPosition(USER);
        assertEq(pos.collateralLocked, 0, "collateral cleared");
        assertEq(pos.debtMUSD, 0, "debt cleared");
        assertTrue(musdReturned > 0, "mUSD returned");
        assertTrue(musdReturned >= depositAmount, "at least initial deposit returned");
    }

    function testWithdrawLeveraged() public {
        uint256 depositAmount = 1 ether;

        vm.startPrank(USER);
        mEth.approve(address(stake), type(uint256).max);
        stake.deposit(depositAmount, 2, "");
        vm.stopPrank();

        SuperStake.Position memory pos = stake.getPosition(USER);
        uint256 initialCollateral = pos.collateralLocked;
        uint256 initialDebt = pos.debtMUSD;

        assertTrue(initialCollateral > depositAmount, "leverage increased collateral");
        assertTrue(initialDebt > _expectedDebt(depositAmount), "leverage increased debt");

        mUsd.mint(USER, initialDebt);

        vm.startPrank(USER);
        mUsd.approve(address(stake), initialDebt);
        uint256 musdReturned = stake.withdraw(pos.collateralLocked, "");
        vm.stopPrank();

        pos = stake.getPosition(USER);
        assertEq(pos.collateralLocked, 0, "collateral cleared");
        assertEq(pos.debtMUSD, 0, "debt cleared");
        assertTrue(musdReturned > 0, "mUSD returned");
        assertTrue(musdReturned >= depositAmount, "at least initial deposit returned");
    }

    function _expectedDebt(uint256 collateral) internal pure returns (uint256) {
        return ((collateral * COLLATERAL_PRICE) / 1e18) * MINT_PERCENTAGE / 10_000;
    }
}
