// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {RWAPool} from "../src/RWAPool.sol";
import {MockERC20} from "./helpers/MockERC20.sol";

contract RWAPoolTest is Test {
    RWAPool public pool;
    MockERC20 public mUSD;
    MockERC20 public rwaToken;
    address public verifier;

    bytes32 public constant IMAGE_ID = keccak256("test_image_id");
    bytes32 public constant JOURNAL_DIGEST = keccak256("test_journal");
    bytes public constant SEAL = "test_seal";

    address public alice = address(0x1);
    address public bob = address(0x2);

    event LiquidityAdded(address indexed provider, uint256 amountMUSD, uint256 amountRWA);
    event LiquidityRemoved(address indexed provider, uint256 amountMUSD, uint256 amountRWA);
    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    function setUp() public {
        mUSD = new MockERC20("Mantle USD", "mUSD");
        rwaToken = new MockERC20("RWA Token", "RWA");
        verifier = address(0x123);

        pool = new RWAPool(address(mUSD), address(rwaToken), verifier, IMAGE_ID);

        mUSD.mint(alice, 1000000 ether);
        rwaToken.mint(alice, 1000000 ether);
        mUSD.mint(bob, 1000000 ether);
        rwaToken.mint(bob, 1000000 ether);

        vm.prank(alice);
        mUSD.approve(address(pool), type(uint256).max);
        vm.prank(alice);
        rwaToken.approve(address(pool), type(uint256).max);

        vm.prank(bob);
        mUSD.approve(address(pool), type(uint256).max);
        vm.prank(bob);
        rwaToken.approve(address(pool), type(uint256).max);
    }

    function testConstructor() public view {
        assertEq(address(pool.mUSD()), address(mUSD));
        assertEq(address(pool.rwaToken()), address(rwaToken));
        assertEq(pool.verifier(), address(verifier));
        assertEq(pool.allowedImageId(), IMAGE_ID);
    }

    function testConstructorRevertsOnZeroAddress() public {
        vm.expectRevert(RWAPool.ZeroAddress.selector);
        new RWAPool(address(0), address(rwaToken), address(verifier), IMAGE_ID);

        vm.expectRevert(RWAPool.ZeroAddress.selector);
        new RWAPool(address(mUSD), address(0), address(verifier), IMAGE_ID);

        vm.expectRevert(RWAPool.ZeroAddress.selector);
        new RWAPool(address(mUSD), address(rwaToken), address(0), IMAGE_ID);
    }

    function testConstructorRevertsOnInvalidImageId() public {
        vm.expectRevert(RWAPool.InvalidImageId.selector);
        new RWAPool(address(mUSD), address(rwaToken), address(verifier), bytes32(0));
    }

    function testAddLiquidityInitial() public {
        uint256 amountMUSD = 1000 ether;
        uint256 amountRWA = 1000 ether;

        vm.expectEmit(true, false, false, true);
        emit LiquidityAdded(alice, amountMUSD, amountRWA);

        vm.prank(alice);
        uint256 liquidity = pool.addLiquidity(amountMUSD, amountRWA, 0);

        assertEq(pool.reserveMUSD(), amountMUSD);
        assertEq(pool.reserveRWA(), amountRWA);
        assertEq(pool.totalLiquidity(), liquidity);
        assertEq(pool.liquidityBalances(alice), liquidity);
        assertEq(liquidity, 1000 ether - 1000);
    }

    function testAddLiquiditySubsequent() public {
        vm.prank(alice);
        pool.addLiquidity(1000 ether, 1000 ether, 0);

        uint256 amountMUSD = 500 ether;
        uint256 amountRWA = 500 ether;

        vm.prank(bob);
        uint256 liquidity = pool.addLiquidity(amountMUSD, amountRWA, 0);

        assertEq(pool.reserveMUSD(), 1500 ether);
        assertEq(pool.reserveRWA(), 1500 ether);
        assertEq(pool.liquidityBalances(bob), liquidity);
        assertEq(liquidity, 500 ether - 500);
    }

    function testAddLiquidityRevertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(RWAPool.ZeroAmount.selector);
        pool.addLiquidity(0, 1000 ether, 0);

        vm.prank(alice);
        vm.expectRevert(RWAPool.ZeroAmount.selector);
        pool.addLiquidity(1000 ether, 0, 0);
    }

    function testRemoveLiquidity() public {
        vm.prank(alice);
        uint256 liquidity = pool.addLiquidity(1000 ether, 1000 ether, 0);

        uint256 aliceBalanceMUSDBefore = mUSD.balanceOf(alice);
        uint256 aliceBalanceRWABefore = rwaToken.balanceOf(alice);

        vm.expectEmit(true, false, false, true);
        emit LiquidityRemoved(alice, 500 ether, 500 ether);

        vm.prank(alice);
        (uint256 amountMUSD, uint256 amountRWA) = pool.removeLiquidity(liquidity / 2, 0, 0);

        assertEq(amountMUSD, 500 ether);
        assertEq(amountRWA, 500 ether);
        assertEq(pool.reserveMUSD(), 500 ether);
        assertEq(pool.reserveRWA(), 500 ether);
        assertEq(pool.liquidityBalances(alice), liquidity / 2);
        assertEq(mUSD.balanceOf(alice), aliceBalanceMUSDBefore + 500 ether);
        assertEq(rwaToken.balanceOf(alice), aliceBalanceRWABefore + 500 ether);
    }

    function testRemoveLiquidityRevertsOnZeroAmount() public {
        vm.prank(alice);
        pool.addLiquidity(1000 ether, 1000 ether, 0);

        vm.prank(alice);
        vm.expectRevert(RWAPool.ZeroAmount.selector);
        pool.removeLiquidity(0, 0, 0);
    }

    function testRemoveLiquidityRevertsOnInsufficientBalance() public {
        vm.prank(alice);
        uint256 liquidity = pool.addLiquidity(1000 ether, 1000 ether, 0);

        vm.prank(bob);
        vm.expectRevert(RWAPool.InsufficientLiquidity.selector);
        pool.removeLiquidity(liquidity, 0, 0);
    }

    function testSwapMUSDForRWA() public {
        vm.prank(alice);
        pool.addLiquidity(1000 ether, 1000 ether, 0);

        uint256 amountIn = 100 ether;
        uint256 expectedOut = pool.getAmountOut(amountIn, 1000 ether, 1000 ether);

        uint256 bobBalanceMUSDBefore = mUSD.balanceOf(bob);
        uint256 bobBalanceRWABefore = rwaToken.balanceOf(bob);

        vm.mockCall(
            verifier,
            abi.encodeWithSignature("verify(bytes,bytes32,bytes32)", SEAL, IMAGE_ID, JOURNAL_DIGEST),
            ""
        );

        vm.expectEmit(true, true, true, true);
        emit Swap(bob, address(mUSD), address(rwaToken), amountIn, expectedOut);

        vm.prank(bob);
        uint256 amountOut = pool.swap(
            address(mUSD),
            address(rwaToken),
            amountIn,
            expectedOut,
            SEAL,
            IMAGE_ID,
            JOURNAL_DIGEST
        );

        assertEq(amountOut, expectedOut);
        assertEq(mUSD.balanceOf(bob), bobBalanceMUSDBefore - amountIn);
        assertEq(rwaToken.balanceOf(bob), bobBalanceRWABefore + amountOut);
        assertEq(pool.reserveMUSD(), 1000 ether + amountIn);
        assertEq(pool.reserveRWA(), 1000 ether - amountOut);
    }

    function testSwapRWAForMUSD() public {
        vm.prank(alice);
        pool.addLiquidity(1000 ether, 1000 ether, 0);

        uint256 amountIn = 100 ether;
        uint256 expectedOut = pool.getAmountOut(amountIn, 1000 ether, 1000 ether);

        vm.mockCall(
            verifier,
            abi.encodeWithSignature("verify(bytes,bytes32,bytes32)", SEAL, IMAGE_ID, JOURNAL_DIGEST),
            ""
        );

        vm.prank(bob);
        uint256 amountOut = pool.swap(
            address(rwaToken),
            address(mUSD),
            amountIn,
            expectedOut,
            SEAL,
            IMAGE_ID,
            JOURNAL_DIGEST
        );

        assertEq(amountOut, expectedOut);
        assertEq(pool.reserveRWA(), 1000 ether + amountIn);
        assertEq(pool.reserveMUSD(), 1000 ether - amountOut);
    }

    function testSwapRevertsOnZeroAmount() public {
        vm.prank(alice);
        pool.addLiquidity(1000 ether, 1000 ether, 0);

        vm.prank(bob);
        vm.expectRevert(RWAPool.ZeroAmount.selector);
        pool.swap(
            address(mUSD),
            address(rwaToken),
            0,
            0,
            SEAL,
            IMAGE_ID,
            JOURNAL_DIGEST
        );
    }

    function testSwapRevertsOnInvalidImageId() public {
        vm.prank(alice);
        pool.addLiquidity(1000 ether, 1000 ether, 0);

        bytes32 wrongImageId = keccak256("wrong_image_id");

        vm.prank(bob);
        vm.expectRevert(RWAPool.InvalidImageId.selector);
        pool.swap(
            address(mUSD),
            address(rwaToken),
            100 ether,
            0,
            SEAL,
            wrongImageId,
            JOURNAL_DIGEST
        );
    }

    function testSwapRevertsOnProofVerificationFailure() public {
        vm.prank(alice);
        pool.addLiquidity(1000 ether, 1000 ether, 0);

        vm.mockCallRevert(
            verifier,
            abi.encodeWithSignature("verify(bytes,bytes32,bytes32)", SEAL, IMAGE_ID, JOURNAL_DIGEST),
            "Proof verification failed"
        );

        vm.prank(bob);
        vm.expectRevert("Proof verification failed");
        pool.swap(
            address(mUSD),
            address(rwaToken),
            100 ether,
            0,
            SEAL,
            IMAGE_ID,
            JOURNAL_DIGEST
        );
    }

    function testSwapRevertsOnInvalidToken() public {
        vm.prank(alice);
        pool.addLiquidity(1000 ether, 1000 ether, 0);

        address invalidToken = address(0x999);

        vm.mockCall(
            verifier,
            abi.encodeWithSignature("verify(bytes,bytes32,bytes32)"),
            ""
        );

        vm.prank(bob);
        vm.expectRevert(RWAPool.InvalidToken.selector);
        pool.swap(
            invalidToken,
            address(rwaToken),
            100 ether,
            0,
            SEAL,
            IMAGE_ID,
            JOURNAL_DIGEST
        );
    }

    function testSwapRevertsOnInsufficientOutput() public {
        vm.prank(alice);
        pool.addLiquidity(1000 ether, 1000 ether, 0);

        uint256 amountIn = 100 ether;
        uint256 expectedOut = pool.getAmountOut(amountIn, 1000 ether, 1000 ether);

        vm.mockCall(
            verifier,
            abi.encodeWithSignature("verify(bytes,bytes32,bytes32)", SEAL, IMAGE_ID, JOURNAL_DIGEST),
            ""
        );

        vm.prank(bob);
        vm.expectRevert(RWAPool.SlippageExceeded.selector);
        pool.swap(
            address(mUSD),
            address(rwaToken),
            amountIn,
            expectedOut + 1,
            SEAL,
            IMAGE_ID,
            JOURNAL_DIGEST
        );
    }


    function testGetAmountOut() public view {
        uint256 amountIn = 100 ether;
        uint256 reserveIn = 1000 ether;
        uint256 reserveOut = 1000 ether;

        uint256 amountOut = pool.getAmountOut(amountIn, reserveIn, reserveOut);

        uint256 amountInWithFee = amountIn * 997;
        uint256 expectedOut = (amountInWithFee * reserveOut) / ((reserveIn * 1000) + amountInWithFee);

        assertEq(amountOut, expectedOut);
    }

    function testGetAmountOutReturnsZeroOnZeroInput() public view {
        assertEq(pool.getAmountOut(0, 1000 ether, 1000 ether), 0);
    }

    function testGetAmountOutReturnsZeroOnZeroReserves() public view {
        assertEq(pool.getAmountOut(100 ether, 0, 1000 ether), 0);
        assertEq(pool.getAmountOut(100 ether, 1000 ether, 0), 0);
    }

    function testGetReserves() public {
        vm.prank(alice);
        pool.addLiquidity(1000 ether, 2000 ether, 0);

        (uint256 reserveMUSD, uint256 reserveRWA) = pool.getReserves();
        assertEq(reserveMUSD, 1000 ether);
        assertEq(reserveRWA, 2000 ether);
    }

    function testMultipleSwaps() public {
        vm.prank(alice);
        pool.addLiquidity(10000 ether, 10000 ether, 0);

        vm.mockCall(
            verifier,
            abi.encodeWithSignature("verify(bytes,bytes32,bytes32)"),
            ""
        );

        vm.prank(bob);
        pool.swap(address(mUSD), address(rwaToken), 100 ether, 0, SEAL, IMAGE_ID, JOURNAL_DIGEST);

        (uint256 reserve1, uint256 reserve2) = pool.getReserves();

        vm.prank(bob);
        pool.swap(address(rwaToken), address(mUSD), 50 ether, 0, SEAL, IMAGE_ID, JOURNAL_DIGEST);

        (uint256 reserve3, uint256 reserve4) = pool.getReserves();

        assertTrue(reserve3 < reserve1);
        assertTrue(reserve4 > reserve2);
    }

    function testProofParametersPassedToVerifier() public {
        vm.prank(alice);
        pool.addLiquidity(1000 ether, 1000 ether, 0);

        bytes memory customSeal = "custom_seal_data";
        bytes32 customJournal = keccak256("custom_journal");

        vm.mockCall(
            verifier,
            abi.encodeWithSignature("verify(bytes,bytes32,bytes32)", customSeal, IMAGE_ID, customJournal),
            ""
        );

        vm.expectCall(
            verifier,
            abi.encodeWithSignature("verify(bytes,bytes32,bytes32)", customSeal, IMAGE_ID, customJournal)
        );

        vm.prank(bob);
        pool.swap(
            address(mUSD),
            address(rwaToken),
            100 ether,
            0,
            customSeal,
            IMAGE_ID,
            customJournal
        );
    }

    function testFuzzAddLiquidity(uint256 amountMUSD, uint256 amountRWA) public {
        amountMUSD = bound(amountMUSD, 1 ether, 100000 ether);
        amountRWA = bound(amountRWA, 1 ether, 100000 ether);

        vm.prank(alice);
        uint256 liquidity = pool.addLiquidity(amountMUSD, amountRWA, 0);

        assertEq(pool.reserveMUSD(), amountMUSD);
        assertEq(pool.reserveRWA(), amountRWA);
        assertGt(liquidity, 0);
    }

    function testFuzzSwap(uint256 amountIn) public {
        vm.prank(alice);
        pool.addLiquidity(10000 ether, 10000 ether, 0);

        amountIn = bound(amountIn, 1 ether, 1000 ether);

        uint256 expectedOut = pool.getAmountOut(amountIn, 10000 ether, 10000 ether);

        vm.mockCall(
            verifier,
            abi.encodeWithSignature("verify(bytes,bytes32,bytes32)"),
            ""
        );

        vm.prank(bob);
        uint256 amountOut = pool.swap(
            address(mUSD),
            address(rwaToken),
            amountIn,
            expectedOut,
            SEAL,
            IMAGE_ID,
            JOURNAL_DIGEST
        );

        assertEq(amountOut, expectedOut);
        assertGt(amountOut, 0);
    }
}
