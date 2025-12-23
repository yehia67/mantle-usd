// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "src/mUSD.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract MockCollateral is ERC20 {
    constructor() ERC20("Mantle Ether", "mETH") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract TestMUSD is Test {
    mUSD token;
    MockCollateral collateral;
    address user = address(0xBEEF);
    address liquidator = address(0xDEAD);

    uint256 constant COLLATERAL_PRICE = 4_000e18; // $4,000 with 1e18 precision
    uint256 constant MINT_PERCENTAGE = 5_000; // 50% expressed in basis points

    function setUp() public {
        token = new mUSD();
        collateral = new MockCollateral();

        token.setCollateralAsset(address(collateral));
        token.setMintPercentageBps(MINT_PERCENTAGE);
        token.setCollateralPriceUsd(COLLATERAL_PRICE);

        collateral.mint(user, 100 ether);
        collateral.mint(liquidator, 100 ether);
        vm.prank(user);
        collateral.approve(address(token), type(uint256).max);
        vm.prank(liquidator);
        collateral.approve(address(token), type(uint256).max);
    }

    function testNameIsMantleUSD() public {
        assertEq(token.name(), "Mantle USD");
    }

    function testLockAndUnlockCollateralFlow() public {
        uint256 collateralToLock = 100 ether;

        vm.prank(user);
        token.lockCollateral(collateralToLock);

        uint256 expectedMint = (collateralToLock * COLLATERAL_PRICE / 1e18) * MINT_PERCENTAGE / 10_000;

        assertEq(token.balanceOf(user), expectedMint, "incorrect mUSD minted");
        assertEq(token.collateralBalances(user), collateralToLock, "collateral tracking mismatch");
        assertEq(token.debtBalances(user), expectedMint, "debt tracking mismatch");

        vm.prank(user);
        token.unlockCollateral(collateralToLock);

        assertEq(token.balanceOf(user), 0, "mUSD should be burned");
        assertEq(token.collateralBalances(user), 0, "collateral balance should reset");
        assertEq(token.debtBalances(user), 0, "debt should reset");
        assertEq(collateral.balanceOf(user), 100 ether, "collateral should be returned");
    }

    function testHealthFactorCalculation() public {
        uint256 collateralToLock = 10 ether;

        vm.prank(user);
        token.lockCollateral(collateralToLock);

        uint256 healthFactor = token.getHealthFactor(user);
        // Collateral value = 10 * 4000e18 = 40000e18
        // Debt = 40000e18 * 5000 / 10000 = 20000e18
        // Health factor = (40000e18 * 100) / 20000e18 = 200
        assertEq(healthFactor, 200, "health factor should be 200%");
    }

    function testPositionNotLiquidatableWhenHealthy() public {
        uint256 collateralToLock = 10 ether;

        vm.prank(user);
        token.lockCollateral(collateralToLock);

        bool isLiquidatable = token.isLiquidatable(user);
        assertTrue(!isLiquidatable, "healthy position should not be liquidatable");
    }

    function testUnlockMaintainsHealthFactor() public {
        uint256 collateralToLock = 10 ether;

        vm.prank(user);
        token.lockCollateral(collateralToLock);

        uint256 healthFactorBefore = token.getHealthFactor(user);

        // Unlock half the collateral
        vm.prank(user);
        token.unlockCollateral(5 ether);

        uint256 healthFactorAfter = token.getHealthFactor(user);

        // Health factor stays the same because debt and collateral scale proportionally
        assertEq(healthFactorBefore, healthFactorAfter, "health factor should remain constant");
    }

    function testLiquidationWhenPriceCrashes() public {
        uint256 collateralToLock = 10 ether;

        vm.prank(user);
        token.lockCollateral(collateralToLock);

        uint256 debtBefore = token.debtBalances(user);
        assertTrue(!token.isLiquidatable(user), "position should be healthy initially");

        // Price crashes from $4,000 to $1,500 (62.5% drop)
        token.setCollateralPriceUsd(1_500e18);

        // Now position is liquidatable
        assertTrue(token.isLiquidatable(user), "position should be liquidatable after price crash");

        // Liquidator needs mUSD to burn the debt
        token.mint(liquidator, debtBefore);

        // Record liquidator's initial collateral balance
        uint256 liquidatorCollateralBefore = collateral.balanceOf(liquidator);

        // Liquidate the position
        vm.prank(liquidator);
        token.liquidate(user);

        // Verify position is cleared
        assertEq(token.collateralBalances(user), 0, "collateral should be seized");
        assertEq(token.debtBalances(user), 0, "debt should be burned");

        // Verify collateral went to liquidator, not mUSD contract
        assertEq(
            collateral.balanceOf(liquidator),
            liquidatorCollateralBefore + collateralToLock,
            "liquidator should receive seized collateral"
        );
        assertEq(collateral.balanceOf(address(token)), 0, "mUSD should not hold collateral after liquidation");
    }

    function testLiquidationFailsOnHealthyPosition() public {
        uint256 collateralToLock = 10 ether;

        vm.prank(user);
        token.lockCollateral(collateralToLock);

        // Try to liquidate healthy position
        vm.prank(liquidator);
        vm.expectRevert("position healthy");
        token.liquidate(user);
    }

    function testLiquidationFailsWithNullAccount() public {
        vm.prank(liquidator);
        vm.expectRevert("account zero");
        token.liquidate(address(0));
    }

    function testLiquidationFailsWithNoCollateral() public {
        vm.prank(liquidator);
        vm.expectRevert("no collateral");
        token.liquidate(user);
    }
}
