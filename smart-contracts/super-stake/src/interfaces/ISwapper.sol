// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISwapper {
    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes calldata data)
        external
        returns (uint256 amountOut);
}
