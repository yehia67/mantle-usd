// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

interface IRWAPoolFactory {
    function createPool(address tokenA, address tokenB, address verifier, bytes32 imageId)
        external
        returns (address pool);
}

interface IRWAPool {
    function addLiquidity(uint256 amountMUSD, uint256 amountRWA, uint256 minLiquidity)
        external
        returns (uint256 liquidity);
}

interface IMUSDToken {
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IERC20Mintable {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
}

contract SetupRWAPoolsScript is Script {
    address constant MUSD = 0x1ADE47C51C4850EcAc5F46Bb9C86835dc2EB5354;
    address constant GOLD = 0x4ABD994Dd8e6581d909A6AcEf82e453d3E141d65;
    address constant REAL_ESTATE = 0x4B55670F4D1e6E2dcafC975931e7BeFeF73cFC53;
    address constant MONEY_MARKET = 0x8D2D9cf7750C88881E12A33D6e305640CDBf020a;
    address constant RWA_POOL_FACTORY = 0x189956C062728196452Fe4330544e1d77D0b01BC;
    address constant ZK_VERIFIER = 0xDBCf221465348424E6e30c95Ff8c3837427A191c;

    bytes32 constant RWA_POLICY_IMAGE_ID =
        0xcc8d9e54ea35adb5416485e372c5db1928bb4cc60b93e494ad227c50ef5b1082;

    uint256 constant RWA_LIQUIDITY_MUSD = 1_000_000_000_000; // 1M mUSD (6 decimals)
    uint256 constant RWA_LIQUIDITY_RWA = 1_000 ether; // 1,000 RWA tokens (18 decimals)

    address public goldPool;
    address public realEstatePool;
    address public moneyMarketPool;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("===========================================");
        console.log("RWA Pools Setup Script");
        console.log("===========================================");
        console.log("Deployer/Owner:", deployer);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        _createRWAPools();
        _provideRWALiquidity(deployer);

        vm.stopBroadcast();

        console.log("");
        console.log("===========================================");
        console.log("RWA Pool Setup Complete!");
        console.log("===========================================");
    }

    function _createRWAPools() internal {
        console.log("Step 1: Creating RWA Pools...");

        IRWAPoolFactory factory = IRWAPoolFactory(RWA_POOL_FACTORY);

        goldPool = factory.createPool(MUSD, GOLD, ZK_VERIFIER, RWA_POLICY_IMAGE_ID);
        console.log("  - Created Gold pool at:", goldPool);

        realEstatePool = factory.createPool(MUSD, REAL_ESTATE, ZK_VERIFIER, RWA_POLICY_IMAGE_ID);
        console.log("  - Created Real Estate pool at:", realEstatePool);

        moneyMarketPool = factory.createPool(MUSD, MONEY_MARKET, ZK_VERIFIER, RWA_POLICY_IMAGE_ID);
        console.log("  - Created Money Market pool at:", moneyMarketPool);

        console.log("");
    }

    function _provideRWALiquidity(address deployer) internal {
        console.log("Step 2: Providing RWA Liquidity...");

        IERC20Mintable(GOLD).mint(deployer, RWA_LIQUIDITY_RWA);
        IERC20Mintable(REAL_ESTATE).mint(deployer, RWA_LIQUIDITY_RWA);
        IERC20Mintable(MONEY_MARKET).mint(deployer, RWA_LIQUIDITY_RWA);
        console.log("  - Minted RWA tokens to:", deployer);

        _addLiquidityToPool(goldPool, GOLD, "Gold");
        _addLiquidityToPool(realEstatePool, REAL_ESTATE, "Real Estate");
        _addLiquidityToPool(moneyMarketPool, MONEY_MARKET, "Money Market");

        console.log("");
    }

    function _addLiquidityToPool(address poolAddress, address rwaToken, string memory poolName) internal {
        IMUSDToken musd = IMUSDToken(MUSD);
        IRWAPool pool = IRWAPool(poolAddress);

        musd.approve(poolAddress, RWA_LIQUIDITY_MUSD);
        IERC20Mintable(rwaToken).approve(poolAddress, RWA_LIQUIDITY_RWA);

        uint256 liquidity = pool.addLiquidity(RWA_LIQUIDITY_MUSD, RWA_LIQUIDITY_RWA, 0);

        console.log("  - Added liquidity to", poolName, "pool:");
        console.log("    * mUSD (6 decimals):", RWA_LIQUIDITY_MUSD);
        console.log("    * RWA tokens:", RWA_LIQUIDITY_RWA / 1e18);
        console.log("    * Liquidity tokens received:", liquidity);
    }
}
