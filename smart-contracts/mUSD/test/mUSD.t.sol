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

    uint256 constant COLLATERAL_PRICE = 4_000e18; // $4,000 with 1e18 precision
    uint256 constant MINT_PERCENTAGE = 5_000; // 50% expressed in basis points

    function setUp() public {
        token = new mUSD();
        collateral = new MockCollateral();

        token.setCollateralAsset(address(collateral));
        token.setMintPercentageBps(MINT_PERCENTAGE);
        token.setCollateralPriceUsd(COLLATERAL_PRICE);

        collateral.mint(user, 100 ether);
        vm.prank(user);
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
}
