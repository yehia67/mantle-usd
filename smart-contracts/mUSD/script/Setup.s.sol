// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

// ============================================
// INTERFACES
// ============================================
interface IMETH {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IMUSDSetup {
    function setCollateralAsset(address token) external;
    function setCollateralPriceUsd(uint256 price) external;
    function setMintPercentageBps(uint256 percentage) external;
    function setMinHealthFactor(uint256 factor) external;
    function lockCollateral(uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function decimals() external view returns (uint8);
}

interface ISuperStake {
    function setTokens(address musd, address meth) external;
    function setSwapper(address swapper) external;
    function setMaxLeverageLoops(uint8 loops) external;
}

interface ISwapper {
    function setTokenDecimals(address token, uint8 decimals) external;
    function setSwapPrice(address tokenIn, address tokenOut, uint256 pricePerUnit) external;
}

interface IRWAPoolFactory {
    function createPool(
        address tokenA,
        address tokenB,
        address verifier,
        bytes32 imageId
    ) external returns (address pool);
    function getPoolByPair(address tokenA, address tokenB) external view returns (address);
}

interface IRWAPool {
    function addLiquidity(
        uint256 amountMUSD,
        uint256 amountRWA,
        uint256 minLiquidity
    ) external returns (uint256 liquidity);
    function reserveMUSD() external view returns (uint256);
    function reserveRWA() external view returns (uint256);
}

interface IERC20Mintable {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title Setup Script for mUSD Platform
 * @notice Configures the entire mUSD platform end-to-end on Mantle Sepolia
 * @dev This script must be executed by the owner address of all deployed contracts
 *      No new contracts are deployed - only configuration and liquidity provision
 */
contract SetupScript is Script {
    // ============================================
    // CONSTANTS - DEPLOYED CONTRACT ADDRESSES
    // ============================================
    // Source: README.md L22-23
    address constant METH = 0xDd37c9e2237506273F86dA1272Ca51470dF6e8ae;
    
    // Source: README.md L25-26
    address constant GOLD = 0x4ABD994Dd8e6581d909A6AcEf82e453d3E141d65;
    
    // Source: User provided
    address constant REAL_ESTATE = 0x4B55670F4D1e6E2dcafC975931e7BeFeF73cFC53;
    
    // Source: User provided
    address constant MONEY_MARKET = 0x8D2D9cf7750C88881E12A33D6e305640CDBf020a;
    
    // Source: README.md L34-35
    address constant SWAPPER = 0x35cc0a5400D745EE96B082a9c70Cf7de44FAAFD3;
    
    // Source: README.md L37-38
    address constant ZK_VERIFIER = 0x3760DA9653Cc7F653FFe664BA4CC3A3f7f3b3EA2;
    
    // Source: README.md L46-47
    address constant MUSD = 0x1ADE47C51C4850EcAc5F46Bb9C86835dc2EB5354;
    
    // Source: README.md L49-50
    address constant SUPER_STAKE = 0x915b4a846bD04180F044214a15446eBd680a64D7;
    
    // Source: README.md L52-53
    address constant RWA_POOL_FACTORY = 0xC78452Df479c7B050Fb8E2225E6f25AEf059C7A1;

    // ============================================
    // CONSTANTS - CONFIGURATION VALUES
    // ============================================
    // Source: User clarification + mUSD.t.sol L23
    uint256 constant COLLATERAL_PRICE = 4_000e18; // 1 mETH = $4,000
    
    // Source: User clarification + mUSD.t.sol L24
    uint256 constant MINT_PERCENTAGE = 5_000; // 50% LTV in basis points
    
    // Source: User clarification + mUSD.sol L22
    uint256 constant MIN_HEALTH_FACTOR = 150; // 150%
    
    // Source: User clarification + SuperStake.t.sol L141
    uint8 constant MAX_LEVERAGE_LOOPS = 3;
    
    // Source: User clarification
    bytes32 constant RWA_POLICY_IMAGE_ID = 0xcc8d9e54ea35adb5416485e372c5db1928bb4cc60b93e494ad227c50ef5b1082;

    // ============================================
    // CONSTANTS - MINT AMOUNTS
    // ============================================
    // Source: User clarification
    uint256 constant METH_MINT_AMOUNT = 2_000_000_000 ether; // 2 billion mETH
    
    // Source: User clarification
    uint256 constant COLLATERAL_LOCK_AMOUNT = 100_000_000 ether; // 100 million mETH
    
    // Calculated: 100M mETH * $4000 * 50% LTV / 1e12 (6 decimals)
    // = 400,000,000,000 USD * 0.5 / 1e12 = 200,000,000,000 / 1e12 = 200,000 mUSD (6 decimals)
    uint256 constant EXPECTED_MUSD_MINT = 200_000_000_000; // 200M mUSD in 6 decimals

    // ============================================
    // CONSTANTS - RWA LIQUIDITY RATIOS
    // ============================================
    // Source: User clarification - 1 RWA token = 1,000 mUSD
    // Using 1,000,000 mUSD : 1,000 RWA ratio for each pool
    uint256 constant RWA_LIQUIDITY_MUSD = 1_000_000_000_000; // 1M mUSD in 6 decimals
    uint256 constant RWA_LIQUIDITY_RWA = 1_000 ether; // 1,000 RWA tokens in 18 decimals

    // ============================================
    // STATE VARIABLES
    // ============================================
    address public goldPool;
    address public realEstatePool;
    address public moneyMarketPool;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("===========================================");
        console.log("mUSD Platform Setup Script");
        console.log("===========================================");
        console.log("Deployer/Owner:", deployer);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Configure mUSD
        _configureMUSD();

        // Step 2: Mint mETH and Lock Collateral
        _mintAndLockCollateral(deployer);

        // Step 3: Configure Super-Stake
        _configureSuperStake();

        // Step 4: Create RWA Pools
        _createRWAPools();

        // Step 5: Provide RWA Liquidity
        _provideRWALiquidity(deployer);

        // Step 6: Validate Setup
        _validateSetup();

        vm.stopBroadcast();

        console.log("");
        console.log("===========================================");
        console.log("Setup Complete!");
        console.log("===========================================");
    }

    /**
     * @notice Step 1: Configure mUSD contract with explicit values
     * @dev Source: User clarification - must call setters explicitly even if defaults match
     */
    function _configureMUSD() internal {
        console.log("Step 1: Configuring mUSD...");
        
        IMUSDSetup musd = IMUSDSetup(MUSD);
        
        // Set collateral token
        musd.setCollateralAsset(METH);
        console.log("  - Set collateral token to mETH:", METH);
        
        // Set collateral price
        musd.setCollateralPriceUsd(COLLATERAL_PRICE);
        console.log("  - Set collateral price to:", COLLATERAL_PRICE);
        
        // Set mint percentage (LTV)
        musd.setMintPercentageBps(MINT_PERCENTAGE);
        console.log("  - Set mint percentage to:", MINT_PERCENTAGE, "bps (50% LTV)");
        
        // Set minimum health factor
        musd.setMinHealthFactor(MIN_HEALTH_FACTOR);
        console.log("  - Set min health factor to:", MIN_HEALTH_FACTOR, "%");
        
        console.log("");
    }

    /**
     * @notice Step 2: Mint mETH and lock collateral to create initial mUSD supply
     * @dev Source: User clarification - NO direct mUSD minting, only via lockCollateral
     */
    function _mintAndLockCollateral(address deployer) internal {
        console.log("Step 2: Minting mETH and Locking Collateral...");
        
        IMETH meth = IMETH(METH);
        IMUSDSetup musd = IMUSDSetup(MUSD);
        
        // Mint mETH to owner
        meth.mint(deployer, METH_MINT_AMOUNT);
        console.log("  - Minted", METH_MINT_AMOUNT / 1e18, "mETH to owner");
        
        // Mint mETH to swapper
        meth.mint(SWAPPER, METH_MINT_AMOUNT);
        console.log("  - Minted", METH_MINT_AMOUNT / 1e18, "mETH to swapper");
        
        // Approve mUSD to spend mETH
        meth.approve(MUSD, COLLATERAL_LOCK_AMOUNT);
        console.log("  - Approved mUSD to spend", COLLATERAL_LOCK_AMOUNT / 1e18, "mETH");
        
        // Lock collateral to mint mUSD
        musd.lockCollateral(COLLATERAL_LOCK_AMOUNT);
        console.log("  - Locked", COLLATERAL_LOCK_AMOUNT / 1e18, "mETH as collateral");
        
        uint256 musdBalance = musd.balanceOf(deployer);
        console.log("  - Minted mUSD balance (6 decimals):", musdBalance);
        console.log("  - Expected mUSD (6 decimals):", EXPECTED_MUSD_MINT);
        
        require(musdBalance >= EXPECTED_MUSD_MINT, "Insufficient mUSD minted");

        // Seed the swapper with mUSD liquidity while retaining the rest for the deployer
        uint256 swapperMusdShare = musdBalance / 2;
        musd.transfer(SWAPPER, swapperMusdShare);
        console.log("  - Transferred", swapperMusdShare, "mUSD to swapper for swap inventory");

        uint256 deployerMusdRemaining = musd.balanceOf(deployer);
        console.log("  - Remaining deployer mUSD balance (6 decimals):", deployerMusdRemaining);
        
        console.log("");
    }

    /**
     * @notice Step 3: Configure Super-Stake contract and Swapper
     * @dev Source: User clarification + SuperStake.t.sol
     */
    function _configureSuperStake() internal {
        console.log("Step 3: Configuring Super-Stake and Swapper...");
        
        // Configure Swapper with token decimals and prices
        ISwapper swapper = ISwapper(SWAPPER);
        
        // Set token decimals
        swapper.setTokenDecimals(MUSD, 6);  // mUSD has 6 decimals
        swapper.setTokenDecimals(METH, 18); // mETH has 18 decimals
        console.log("  - Set token decimals: mUSD=6, mETH=18");
        
        // Set swap prices
        // 1 mETH (1e18) = 4000 mUSD (4000e6)
        swapper.setSwapPrice(METH, MUSD, 4000e6);
        console.log("  - Set swap price: 1 mETH = 4000 mUSD");
        
        // 1 mUSD (1e6) = 0.00025 mETH (0.00025e18)
        // Calculation: 1 / 4000 = 0.00025
        swapper.setSwapPrice(MUSD, METH, 0.00025e18);
        console.log("  - Set swap price: 1 mUSD = 0.00025 mETH");
        
        // Configure SuperStake
        ISuperStake superStake = ISuperStake(SUPER_STAKE);
        
        // Set tokens
        superStake.setTokens(MUSD, METH);
        console.log("  - Set tokens: mUSD =", MUSD, ", mETH =", METH);
        
        // Set swapper
        superStake.setSwapper(SWAPPER);
        console.log("  - Set swapper to:", SWAPPER);
        
        // Set max leverage loops
        superStake.setMaxLeverageLoops(MAX_LEVERAGE_LOOPS);
        console.log("  - Set max leverage loops to:", MAX_LEVERAGE_LOOPS);
        
        console.log("");
    }

    /**
     * @notice Step 4: Create RWA pools via factory
     * @dev Source: User clarification + RWAPoolFactory.t.sol
     */
    function _createRWAPools() internal {
        console.log("Step 4: Creating RWA Pools...");
        
        IRWAPoolFactory factory = IRWAPoolFactory(RWA_POOL_FACTORY);
        
        // Create Gold pool
        goldPool = factory.createPool(MUSD, GOLD, ZK_VERIFIER, RWA_POLICY_IMAGE_ID);
        console.log("  - Created Gold pool at:", goldPool);
        
        // Create Real Estate pool
        realEstatePool = factory.createPool(MUSD, REAL_ESTATE, ZK_VERIFIER, RWA_POLICY_IMAGE_ID);
        console.log("  - Created Real Estate pool at:", realEstatePool);
        
        // Create Money Market pool
        moneyMarketPool = factory.createPool(MUSD, MONEY_MARKET, ZK_VERIFIER, RWA_POLICY_IMAGE_ID);
        console.log("  - Created Money Market pool at:", moneyMarketPool);
        
        console.log("");
    }

    /**
     * @notice Step 5: Provide liquidity to all RWA pools
     * @dev Source: User clarification - 1 RWA token = 1,000 mUSD ratio
     */
    function _provideRWALiquidity(address deployer) internal {
        console.log("Step 5: Providing RWA Liquidity...");
        
        // Mint RWA tokens to deployer
        IERC20Mintable(GOLD).mint(deployer, RWA_LIQUIDITY_RWA);
        IERC20Mintable(REAL_ESTATE).mint(deployer, RWA_LIQUIDITY_RWA);
        IERC20Mintable(MONEY_MARKET).mint(deployer, RWA_LIQUIDITY_RWA);
        console.log("  - Minted RWA tokens to:", deployer);
        
        // Add liquidity to Gold pool
        _addLiquidityToPool(goldPool, GOLD, "Gold");
        
        // Add liquidity to Real Estate pool
        _addLiquidityToPool(realEstatePool, REAL_ESTATE, "Real Estate");
        
        // Add liquidity to Money Market pool
        _addLiquidityToPool(moneyMarketPool, MONEY_MARKET, "Money Market");
        
        console.log("");
    }

    /**
     * @notice Helper function to add liquidity to a specific pool
     */
    function _addLiquidityToPool(address poolAddress, address rwaToken, string memory poolName) internal {
        IMUSDSetup musd = IMUSDSetup(MUSD);
        IRWAPool pool = IRWAPool(poolAddress);
        
        // Approve pool to spend mUSD
        musd.approve(poolAddress, RWA_LIQUIDITY_MUSD);
        
        // Approve pool to spend RWA token
        IERC20Mintable(rwaToken).approve(poolAddress, RWA_LIQUIDITY_RWA);
        
        // Add liquidity
        uint256 liquidity = pool.addLiquidity(RWA_LIQUIDITY_MUSD, RWA_LIQUIDITY_RWA, 0);
        
        console.log("  - Added liquidity to", poolName, "pool:");
        console.log("    * mUSD (6 decimals):", RWA_LIQUIDITY_MUSD);
        console.log("    * RWA tokens:", RWA_LIQUIDITY_RWA / 1e18);
        console.log("    * Liquidity tokens received:", liquidity);
    }

    /**
     * @notice Step 6: Validate the entire setup
     * @dev Source: User requirements - assert critical invariants
     */
    function _validateSetup() internal view {
        console.log("Step 6: Validating Setup...");
        
        IMUSDSetup musd = IMUSDSetup(MUSD);
        
        // Validate mUSD total supply
        uint256 totalSupply = musd.totalSupply();
        console.log("  - mUSD total supply (6 decimals):", totalSupply);
        require(totalSupply > 0, "mUSD total supply is zero");
        
        // Validate pool liquidity
        IRWAPool goldPoolContract = IRWAPool(goldPool);
        uint256 goldReserveMUSD = goldPoolContract.reserveMUSD();
        uint256 goldReserveRWA = goldPoolContract.reserveRWA();
        console.log("  - Gold pool reserves:");
        console.log("    * mUSD:", goldReserveMUSD);
        console.log("    * RWA:", goldReserveRWA);
        require(goldReserveMUSD > 0 && goldReserveRWA > 0, "Gold pool has no liquidity");
        
        IRWAPool realEstatePoolContract = IRWAPool(realEstatePool);
        uint256 realEstateReserveMUSD = realEstatePoolContract.reserveMUSD();
        uint256 realEstateReserveRWA = realEstatePoolContract.reserveRWA();
        console.log("  - Real Estate pool reserves:");
        console.log("    * mUSD:", realEstateReserveMUSD);
        console.log("    * RWA:", realEstateReserveRWA);
        require(realEstateReserveMUSD > 0 && realEstateReserveRWA > 0, "Real Estate pool has no liquidity");
        
        IRWAPool moneyMarketPoolContract = IRWAPool(moneyMarketPool);
        uint256 moneyMarketReserveMUSD = moneyMarketPoolContract.reserveMUSD();
        uint256 moneyMarketReserveRWA = moneyMarketPoolContract.reserveRWA();
        console.log("  - Money Market pool reserves:");
        console.log("    * mUSD:", moneyMarketReserveMUSD);
        console.log("    * RWA:", moneyMarketReserveRWA);
        require(moneyMarketReserveMUSD > 0 && moneyMarketReserveRWA > 0, "Money Market pool has no liquidity");
        
        console.log("  - All validations passed!");
        console.log("");
    }
}
