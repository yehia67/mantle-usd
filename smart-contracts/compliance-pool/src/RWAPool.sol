// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "forge-std/interfaces/IERC20.sol";

/// @title RWAPool
/// @notice AMM pool for mUSD ↔ RWA token swaps with RISC Zero proof verification
/// @dev All swaps require valid RISC Zero proofs to ensure compliance
contract RWAPool {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    IERC20 public immutable mUSD;
    IERC20 public immutable rwaToken;
    address public immutable verifier;
    bytes32 public immutable allowedImageId;

    uint256 public reserveMUSD;
    uint256 public reserveRWA;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event LiquidityAdded(address indexed provider, uint256 amountMUSD, uint256 amountRWA);
    event LiquidityRemoved(address indexed provider, uint256 amountMUSD, uint256 amountRWA);
    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error ZeroAddress();
    error InvalidImageId();
    error ProofVerificationFailed();
    error InsufficientLiquidity();
    error InsufficientOutput();

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @notice Initialize a new RWA liquidity pool
    /// @param _mUSD Address of mUSD stablecoin
    /// @param _rwaToken Address of RWA token
    /// @param _verifier Address of RISC Zero verifier contract
    /// @param _allowedImageId Allowed RISC Zero image ID for compliance proofs
    constructor(address _mUSD, address _rwaToken, address _verifier, bytes32 _allowedImageId) {
        if (_mUSD == address(0) || _rwaToken == address(0) || _verifier == address(0)) {
            revert ZeroAddress();
        }
        if (_allowedImageId == bytes32(0)) revert InvalidImageId();

        mUSD = IERC20(_mUSD);
        rwaToken = IERC20(_rwaToken);
        verifier = _verifier;
        allowedImageId = _allowedImageId;
    }

    /*//////////////////////////////////////////////////////////////
                            POOL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata proof
    ) external returns (uint256 amountOut) {
        revert("Not implemented");
    }

   
    function addLiquidity(uint256 amountMUSD, uint256 amountRWA) external returns (uint256 liquidity) {
        revert("Not implemented");
    }

   
    function removeLiquidity(uint256 liquidity) external returns (uint256 amountMUSD, uint256 amountRWA) {
        revert("Not implemented");
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getReserves() external view returns (uint256 _reserveMUSD, uint256 _reserveRWA) {
        return (reserveMUSD, reserveRWA);
    }


    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        public
        pure
        returns (uint256 amountOut)
    {
        if (amountIn == 0) return 0;
        if (reserveIn == 0 || reserveOut == 0) return 0;

        // Apply 0.3% fee
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }
}
