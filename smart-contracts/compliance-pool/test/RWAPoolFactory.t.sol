// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {RWAPoolFactory} from "../src/RWAPoolFactory.sol";
import {IRWAPoolFactory} from "../src/interfaces/IRWAPoolFactory.sol";
import {RWAPool} from "../src/RWAPool.sol";
import {MockERC20} from "./helpers/MockERC20.sol";

contract RWAPoolFactoryTest is Test {
    RWAPoolFactory public factory;
    MockERC20 public mUSD;
    MockERC20 public rwaToken1;
    MockERC20 public rwaToken2;
    address public verifier;
    bytes32 public imageId;

    address public constant DEPLOYER = address(0x1);

    function setUp() public {
        factory = new RWAPoolFactory();
        mUSD = new MockERC20("Mantle USD", "mUSD");
        rwaToken1 = new MockERC20("RWA Token 1", "RWA1");
        rwaToken2 = new MockERC20("RWA Token 2", "RWA2");
        verifier = address(0x123);
        imageId = keccak256("test-image-id");
    }

    function testCreatePool() public {
        vm.prank(DEPLOYER);
        address pool = factory.createPool(address(mUSD), address(rwaToken1), address(verifier), imageId);

        assertTrue(pool != address(0), "Pool should be deployed");
        assertTrue(factory.isPool(pool), "Pool should be registered");
        assertEq(factory.allPoolsLength(), 1, "Should have 1 pool");
        assertEq(factory.allPools(0), pool, "Pool should be at index 0");
    }

    function testCreatePoolEmitsEvent() public {
        vm.expectEmit(false, true, true, true);
        emit IRWAPoolFactory.PoolCreated(address(0), address(mUSD), address(rwaToken1), address(verifier), imageId, 0);

        vm.prank(DEPLOYER);
        factory.createPool(address(mUSD), address(rwaToken1), address(verifier), imageId);
    }

    function testCreatePoolStoresCorrectParams() public {
        vm.prank(DEPLOYER);
        address poolAddress = factory.createPool(address(mUSD), address(rwaToken1), address(verifier), imageId);

        RWAPool pool = RWAPool(poolAddress);
        assertEq(address(pool.mUSD()), address(mUSD), "mUSD should match");
        assertEq(address(pool.rwaToken()), address(rwaToken1), "RWA token should match");
        assertEq(pool.verifier(), address(verifier), "Verifier should match");
        assertEq(pool.allowedImageId(), imageId, "Image ID should match");
    }

    function testCreateMultiplePools() public {
        vm.startPrank(DEPLOYER);
        address pool1 = factory.createPool(address(mUSD), address(rwaToken1), address(verifier), imageId);
        address pool2 = factory.createPool(address(mUSD), address(rwaToken2), address(verifier), imageId);
        vm.stopPrank();

        assertEq(factory.allPoolsLength(), 2, "Should have 2 pools");
        assertTrue(pool1 != pool2, "Pools should have different addresses");
        assertTrue(factory.isPool(pool1), "Pool 1 should be registered");
        assertTrue(factory.isPool(pool2), "Pool 2 should be registered");
    }

    function testGetPoolByPair() public {
        vm.prank(DEPLOYER);
        address pool = factory.createPool(address(mUSD), address(rwaToken1), address(verifier), imageId);

        address retrievedPool = factory.getPoolByPair(address(mUSD), address(rwaToken1));
        assertEq(retrievedPool, pool, "Should retrieve correct pool");

        // Test reverse order
        address retrievedPoolReverse = factory.getPoolByPair(address(rwaToken1), address(mUSD));
        assertEq(retrievedPoolReverse, pool, "Should retrieve same pool regardless of order");
    }

    function testCannotCreateDuplicatePool() public {
        vm.startPrank(DEPLOYER);
        factory.createPool(address(mUSD), address(rwaToken1), address(verifier), imageId);

        vm.expectRevert(IRWAPoolFactory.PoolAlreadyExists.selector);
        factory.createPool(address(mUSD), address(rwaToken1), address(verifier), imageId);
        vm.stopPrank();
    }

    function testCannotCreateDuplicatePoolReverseOrder() public {
        vm.startPrank(DEPLOYER);
        factory.createPool(address(mUSD), address(rwaToken1), address(verifier), imageId);

        vm.expectRevert(IRWAPoolFactory.PoolAlreadyExists.selector);
        factory.createPool(address(rwaToken1), address(mUSD), address(verifier), imageId);
        vm.stopPrank();
    }

    function testCannotCreatePoolWithZeroAddress() public {
        vm.startPrank(DEPLOYER);

        vm.expectRevert(IRWAPoolFactory.ZeroAddress.selector);
        factory.createPool(address(0), address(rwaToken1), address(verifier), imageId);

        vm.expectRevert(IRWAPoolFactory.ZeroAddress.selector);
        factory.createPool(address(mUSD), address(0), address(verifier), imageId);

        vm.expectRevert(IRWAPoolFactory.ZeroAddress.selector);
        factory.createPool(address(mUSD), address(rwaToken1), address(0), imageId);

        vm.stopPrank();
    }

    function testCannotCreatePoolWithZeroImageId() public {
        vm.prank(DEPLOYER);
        vm.expectRevert(IRWAPoolFactory.InvalidImageId.selector);
        factory.createPool(address(mUSD), address(rwaToken1), address(verifier), bytes32(0));
    }

    function testCannotCreatePoolWithIdenticalTokens() public {
        vm.prank(DEPLOYER);
        vm.expectRevert(IRWAPoolFactory.IdenticalAddresses.selector);
        factory.createPool(address(mUSD), address(mUSD), address(verifier), imageId);
    }

    function testGetAllPools() public {
        vm.startPrank(DEPLOYER);
        address pool1 = factory.createPool(address(mUSD), address(rwaToken1), address(verifier), imageId);
        address pool2 = factory.createPool(address(mUSD), address(rwaToken2), address(verifier), imageId);
        vm.stopPrank();

        address[] memory pools = factory.getAllPools();
        assertEq(pools.length, 2, "Should return 2 pools");
        assertEq(pools[0], pool1, "First pool should match");
        assertEq(pools[1], pool2, "Second pool should match");
    }

    function testGetPoolAtIndex() public {
        vm.startPrank(DEPLOYER);
        address pool1 = factory.createPool(address(mUSD), address(rwaToken1), address(verifier), imageId);
        address pool2 = factory.createPool(address(mUSD), address(rwaToken2), address(verifier), imageId);
        vm.stopPrank();

        assertEq(factory.getPoolAtIndex(0), pool1, "Index 0 should return pool1");
        assertEq(factory.getPoolAtIndex(1), pool2, "Index 1 should return pool2");
    }

    function testGetPoolAtIndexOutOfBounds() public {
        vm.expectRevert(IRWAPoolFactory.IndexOutOfBounds.selector);
        factory.getPoolAtIndex(0);
    }

    function testPoolIndex() public {
        vm.startPrank(DEPLOYER);
        address pool1 = factory.createPool(address(mUSD), address(rwaToken1), address(verifier), imageId);
        address pool2 = factory.createPool(address(mUSD), address(rwaToken2), address(verifier), imageId);
        vm.stopPrank();

        assertEq(factory.poolIndex(pool1), 0, "Pool1 should be at index 0");
        assertEq(factory.poolIndex(pool2), 1, "Pool2 should be at index 1");
    }
}
