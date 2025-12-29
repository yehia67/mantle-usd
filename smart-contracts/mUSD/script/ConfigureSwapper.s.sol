// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

interface ISwapper {
    function setTokenDecimals(address token, uint8 decimals) external;
    function setSwapPrice(address tokenIn, address tokenOut, uint256 pricePerUnit) external;
}

contract ConfigureSwapperScript is Script {
    // Deployed contract addresses
    address constant MUSD = 0x1ADE47C51C4850EcAc5F46Bb9C86835dc2EB5354;
    address constant METH = 0xDd37c9e2237506273F86dA1272Ca51470dF6e8ae;
    address constant SWAPPER = 0x35cc0a5400D745EE96B082a9c70Cf7de44FAAFD3;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        console.log("===========================================");
        console.log("Configuring Swapper for mUSD (6 decimals)");
        console.log("===========================================");
        console.log("Swapper:", SWAPPER);
        console.log("mUSD:", MUSD);
        console.log("mETH:", METH);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        ISwapper swapper = ISwapper(SWAPPER);
        
        // Set token decimals
        console.log("Setting token decimals...");
        swapper.setTokenDecimals(MUSD, 6);  // mUSD has 6 decimals
        console.log("  - mUSD decimals: 6");
        
        swapper.setTokenDecimals(METH, 18); // mETH has 18 decimals
        console.log("  - mETH decimals: 18");
        
        // Set swap prices
        console.log("");
        console.log("Setting swap prices...");
        
        // 1 mETH (1e18) = 4000 mUSD (4000e6)
        swapper.setSwapPrice(METH, MUSD, 4000e6);
        console.log("  - 1 mETH = 4000 mUSD");
        
        // 1 mUSD (1e6) = 0.00025 mETH (0.00025e18 = 250000000000000)
        // Calculation: 1 / 4000 = 0.00025
        swapper.setSwapPrice(MUSD, METH, 0.00025e18);
        console.log("  - 1 mUSD = 0.00025 mETH");

        vm.stopBroadcast();

        console.log("");
        console.log("===========================================");
        console.log("Swapper Configuration Complete!");
        console.log("===========================================");
        console.log("You can now use SuperStake with leverage");
    }
}
