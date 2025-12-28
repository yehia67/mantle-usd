// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "src/SuperStake.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {MockSwapper} from "./mocks/MockSwapper.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockMUSD is ERC20, IMUSD {
    using SafeERC20 for IERC20;

    IERC20 private _collateralAsset;
    uint256 private _mintPercentageBps = 5_000;
    uint256 private _collateralPriceUsd = 4_000e18;
    uint256 private _minHealthFactor = 150;

    mapping(address => uint256) private _collateralBalances;
    mapping(address => uint256) private _debtBalances;

    constructor(IERC20 collateral) ERC20("Mock mUSD", "mUSD") {
        _collateralAsset = collateral;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function lockCollateral(uint256 amount) external override {
        _collateralAsset.safeTransferFrom(msg.sender, address(this), amount);
        _collateralBalances[msg.sender] += amount;
        uint256 debt = _calcDebt(amount);
        _debtBalances[msg.sender] += debt;
        _mint(msg.sender, debt);
    }

    function unlockCollateral(uint256 amount) external override {
        uint256 debt = _calcDebt(amount);
        _collateralBalances[msg.sender] -= amount;
        _debtBalances[msg.sender] -= debt;
        _burn(msg.sender, debt);
        _collateralAsset.safeTransfer(msg.sender, amount);
    }

    function _calcDebt(uint256 amount) internal view returns (uint256) {
        // Returns debt in 6 decimals (mUSD decimals)
        // amount (18 decimals) * price (18 decimals) / 1e18 = USD value (18 decimals)
        // USD value * percentage / 10_000 = debt in 18 decimals
        // Convert to 6 decimals: / 1e12
        return (((amount * _collateralPriceUsd) / 1e18) * _mintPercentageBps / 10_000) / 1e12;
    }

    function mint(address to, uint256 amount) external override {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external override {
        _burn(from, amount);
    }

    function setCollateralAsset(address newCollateral) external override {
        _collateralAsset = IERC20(newCollateral);
        emit CollateralAssetUpdated(newCollateral);
    }

    function setMintPercentageBps(uint256 newPercentage) external override {
        _mintPercentageBps = newPercentage;
        emit MintPercentageUpdated(newPercentage);
    }

    function setCollateralPriceUsd(uint256 price) external override {
        _collateralPriceUsd = price;
        emit CollateralPriceUpdated(price);
    }

    function setMinHealthFactor(uint256 newFactor) external override {
        _minHealthFactor = newFactor;
        emit MinHealthFactorUpdated(newFactor);
    }

    function liquidate(address account) external override {
        emit PositionLiquidated(account, msg.sender, 0, 0);
    }

    function getHealthFactor(address) external view override returns (uint256) {
        return type(uint256).max;
    }

    function isLiquidatable(address) external pure override returns (bool) {
        return false;
    }

    function collateralAsset() external view override returns (IERC20) {
        return _collateralAsset;
    }

    function mintPercentageBps() external view override returns (uint256) {
        return _mintPercentageBps;
    }

    function collateralPriceUsd() external view override returns (uint256) {
        return _collateralPriceUsd;
    }

    function minHealthFactor() external view override returns (uint256) {
        return _minHealthFactor;
    }

    function collateralBalances(address account) external view override returns (uint256) {
        return _collateralBalances[account];
    }

    function debtBalances(address account) external view override returns (uint256) {
        return _debtBalances[account];
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

        // Configure token decimals in swapper
        swapper.setTokenDecimals(address(mEth), 18);
        swapper.setTokenDecimals(address(mUsd), 6);

        // Set swap prices: 1 mETH (18 decimals) = 4000 mUSD (6 decimals)
        // For mETH to mUSD: 1e18 mETH -> 4000e6 mUSD
        swapper.setSwapPrice(address(mEth), address(mUsd), 4000e6);
        // For mUSD to mETH: 1e6 mUSD -> (1e18 / 4000) mETH = 0.00025e18 mETH
        swapper.setSwapPrice(address(mUsd), address(mEth), 1e18 / 4000);

        mEth.mint(USER, 100 ether);
        mEth.mint(address(swapper), 1_000_000_000_000 ether);
        mUsd.mint(address(swapper), 1_000_000_000_000e6); // 6 decimals
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
        // Convert depositAmount (18 decimals mETH) to mUSD equivalent (6 decimals)
        // 1 mETH = 4000 mUSD, so depositAmount * 4000 / 1e12
        uint256 expectedMinMusd = (depositAmount * 4000) / 1e12;
        assertTrue(musdReturned >= expectedMinMusd, "at least initial deposit value returned");
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
        // Convert depositAmount (18 decimals mETH) to mUSD equivalent (6 decimals)
        // 1 mETH = 4000 mUSD, so depositAmount * 4000 / 1e12
        uint256 expectedMinMusd = (depositAmount * 4000) / 1e12;
        assertTrue(musdReturned >= expectedMinMusd, "at least initial deposit value returned");
    }

    function _expectedDebt(uint256 collateral) internal pure returns (uint256) {
        // mUSD has 6 decimals, so debt calculation returns 6 decimal value
        // collateral (18 decimals) * price (18 decimals) / 1e18 = USD value (18 decimals)
        // USD value * percentage / 10_000 = debt in 18 decimals
        // Convert to 6 decimals: / 1e12
        return (((collateral * COLLATERAL_PRICE) / 1e18) * MINT_PERCENTAGE / 10_000) / 1e12;
    }

    function testDepositAndWithdrawFullCycle() public {
        uint256 depositAmount = 1 ether; // 1 mETH
        uint8 loops = 3;

        // Initial deposit with 3 loops
        vm.startPrank(USER);
        mEth.approve(address(stake), depositAmount);
        (uint256 collateralLocked, uint256 debtMinted) = stake.deposit(depositAmount, loops, "");
        vm.stopPrank();

        // Verify position after deposit
        SuperStake.Position memory pos = stake.getPosition(USER);
        assertEq(pos.collateralLocked, collateralLocked, "position collateral matches");
        assertEq(pos.debtMUSD, debtMinted, "position debt matches");
        assertTrue(collateralLocked > depositAmount, "leverage increased collateral");
        assertTrue(debtMinted > 0, "debt was minted");

        // Log position details for verification
        emit log_named_uint("Collateral Locked (mETH)", collateralLocked);
        emit log_named_uint("Debt Minted (mUSD, 6 decimals)", debtMinted);
        emit log_named_uint("Expected single loop debt", _expectedDebt(depositAmount));

        // Mint enough mUSD to cover the debt for withdrawal
        mUsd.mint(USER, debtMinted);

        // Withdraw full position
        vm.startPrank(USER);
        mUsd.approve(address(stake), debtMinted);
        uint256 musdReturned = stake.withdraw(pos.collateralLocked, "");
        vm.stopPrank();

        // Verify position is cleared
        pos = stake.getPosition(USER);
        assertEq(pos.collateralLocked, 0, "collateral fully withdrawn");
        assertEq(pos.debtMUSD, 0, "debt fully repaid");
        assertTrue(musdReturned > 0, "mUSD was returned");

        emit log_named_uint("mUSD Returned (6 decimals)", musdReturned);
    }
}
