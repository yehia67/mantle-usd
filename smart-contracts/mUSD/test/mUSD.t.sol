// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "src/mUSD.sol";

contract TestMUSD is Test {
    mUSD token;

    function setUp() public {
        token = new mUSD();
    }

    function testNameIsMantleUSD() public {
        assertEq(token.name(), "Mantle USD");
    }
}
