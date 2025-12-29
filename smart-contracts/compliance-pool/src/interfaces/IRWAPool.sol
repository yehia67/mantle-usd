// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "forge-std/interfaces/IERC20.sol";

interface IRWAPool {
    event LiquidityAdded(address indexed provider, uint256 amountMUSD, uint256 amountRWA);
    event LiquidityRemoved(address indexed provider, uint256 amountMUSD, uint256 amountRWA);
    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    error ZeroAddress();
    error InvalidImageId();
    error ProofVerificationFailed();
    error InsufficientLiquidity();
    error InvalidToken();
    error ZeroAmount();
    error SlippageExceeded();

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata seal,
        bytes32 imageId,
        bytes32 journalDigest
    ) external returns (uint256 amountOut);

    function addLiquidity(uint256 amountMUSD, uint256 amountRWA, uint256 minLiquidity)
        external
        returns (uint256 liquidity);

    function removeLiquidity(uint256 liquidity, uint256 minAmountMUSD, uint256 minAmountRWA)
        external
        returns (uint256 amountMUSD, uint256 amountRWA);

    function getReserves() external view returns (uint256 _reserveMUSD, uint256 _reserveRWA);

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        external
        pure
        returns (uint256 amountOut);

    function setAllowedImageId(bytes32 newImageId) external;
    function setVerifier(address newVerifier) external;

    function liquidityBalances(address provider) external view returns (uint256);
    function reserveMUSD() external view returns (uint256);
    function reserveRWA() external view returns (uint256);
    function totalLiquidity() external view returns (uint256);
    function mUSD() external view returns (IERC20);
    function rwaToken() external view returns (IERC20);
}
