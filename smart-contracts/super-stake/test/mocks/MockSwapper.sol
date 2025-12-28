// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapper} from "../../src/interfaces/ISwapper.sol";

/**
 * @notice Mock swapper with configurable exchange rates for testing
 * @dev Allows setting custom swap prices like 1 mETH = 1000 mUSD
 */
contract MockSwapper is ISwapper {
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => uint256)) public swapPrices;
    mapping(address => uint8) public tokenDecimals;

    /**
     * @notice Set the decimals for a token
     */
    function setTokenDecimals(address token, uint8 decimals) external {
        tokenDecimals[token] = decimals;
    }

    /**
     * @notice Set the swap price for a token pair
     * @param tokenIn The input token address
     * @param tokenOut The output token address
     * @param pricePerUnit Price in tokenOut for 1 full unit of tokenIn (considering tokenIn decimals)
     * @dev Example: To swap 1 mETH (18 decimals) for 4000 mUSD (6 decimals):
     *      setSwapPrice(mETH, mUSD, 4000e6) means 1e18 mETH = 4000e6 mUSD
     *      To swap 1 mUSD (6 decimals) for 0.00025 mETH:
     *      setSwapPrice(mUSD, mETH, 0.00025e18) means 1e6 mUSD = 0.00025e18 mETH
     */
    function setSwapPrice(address tokenIn, address tokenOut, uint256 pricePerUnit) external {
        swapPrices[tokenIn][tokenOut] = pricePerUnit;
    }

    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes calldata)
        external
        returns (uint256 amountOut)
    {
        require(amountIn > 0, "amount zero");
        
        uint256 price = swapPrices[tokenIn][tokenOut];
        
        if (price == 0) {
            amountOut = amountIn;
        } else {
            uint8 decimalsIn = tokenDecimals[tokenIn];
            if (decimalsIn == 0) decimalsIn = 18; // Default to 18 if not set
            
            uint256 scaleFactor = 10 ** decimalsIn;
            // Calculate output: (amountIn * price) / scaleFactor
            // This works because price is defined per 1 full unit of tokenIn
            amountOut = (amountIn * price) / scaleFactor;
        }
        
        require(amountOut >= minAmountOut, "slippage");
        
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        
        return amountOut;
    }
}
