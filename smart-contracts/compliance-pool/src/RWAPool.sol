// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IRiscZeroVerifier} from "risc0-ethereum/contracts/src/IRiscZeroVerifier.sol";
import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/// @title RWAPool
/// @notice AMM pool for mUSD ↔ RWA token swaps with RISC Zero proof verification
/// @dev All swaps require valid RISC Zero proofs to ensure compliance
contract RWAPool is ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    IERC20 public immutable mUSD;
    IERC20 public immutable rwaToken;
    address public immutable verifier;
    bytes32 public immutable allowedImageId;

    uint256 public reserveMUSD;
    uint256 public reserveRWA;
    uint256 public totalLiquidity;
    
    mapping(address => uint256) public liquidityBalances;

    uint256 private constant MINIMUM_LIQUIDITY = 1000;
    uint256 private constant FEE_NUMERATOR = 997;
    uint256 private constant FEE_DENOMINATOR = 1000;

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
    error InvalidToken();
    error ZeroAmount();
    error SlippageExceeded();

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
        bytes calldata seal,
        bytes32 imageId,
        bytes32 journalDigest
    ) external nonReentrant returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();
        
        if (imageId != allowedImageId) revert InvalidImageId();
        
        uint256 reserveIn;
        uint256 reserveOut;
        IERC20 tokenInContract;
        IERC20 tokenOutContract;
        
        if (tokenIn == address(mUSD) && tokenOut == address(rwaToken)) {
            reserveIn = reserveMUSD;
            reserveOut = reserveRWA;
            tokenInContract = mUSD;
            tokenOutContract = rwaToken;
        } else if (tokenIn == address(rwaToken) && tokenOut == address(mUSD)) {
            reserveIn = reserveRWA;
            reserveOut = reserveMUSD;
            tokenInContract = rwaToken;
            tokenOutContract = mUSD;
        } else {
            revert InvalidToken();
        }
        
        amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        if (amountOut < minAmountOut) revert SlippageExceeded();
        if (amountOut > reserveOut) revert InsufficientLiquidity();
        
        if (tokenIn == address(mUSD)) {
            reserveMUSD += amountIn;
            reserveRWA -= amountOut;
        } else {
            reserveRWA += amountIn;
            reserveMUSD -= amountOut;
        }
        
        IRiscZeroVerifier(verifier).verify(seal, imageId, journalDigest);
        
        tokenInContract.transferFrom(msg.sender, address(this), amountIn);
        tokenOutContract.transfer(msg.sender, amountOut);
        
        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    function addLiquidity(uint256 amountMUSD, uint256 amountRWA, uint256 minLiquidity) external nonReentrant returns (uint256 liquidity) {
        if (amountMUSD == 0 || amountRWA == 0) revert ZeroAmount();
        
        if (totalLiquidity == 0) {
            liquidity = Math.sqrt(Math.mulDiv(amountMUSD, amountRWA, 1));
            if (liquidity <= MINIMUM_LIQUIDITY) revert InsufficientLiquidity();
            liquidity -= MINIMUM_LIQUIDITY;
        } else {
            uint256 liquidityMUSD = (amountMUSD * totalLiquidity) / reserveMUSD;
            uint256 liquidityRWA = (amountRWA * totalLiquidity) / reserveRWA;
            liquidity = liquidityMUSD < liquidityRWA ? liquidityMUSD : liquidityRWA;
            if (liquidity == 0) revert InsufficientLiquidity();
        }
        
        if (liquidity < minLiquidity) revert SlippageExceeded();
        
        reserveMUSD += amountMUSD;
        reserveRWA += amountRWA;
        totalLiquidity += liquidity;
        liquidityBalances[msg.sender] += liquidity;
        
        mUSD.transferFrom(msg.sender, address(this), amountMUSD);
        rwaToken.transferFrom(msg.sender, address(this), amountRWA);
        
        emit LiquidityAdded(msg.sender, amountMUSD, amountRWA);
    }

    function removeLiquidity(uint256 liquidity, uint256 minAmountMUSD, uint256 minAmountRWA) external nonReentrant returns (uint256 amountMUSD, uint256 amountRWA) {
        if (liquidity == 0) revert ZeroAmount();
        if (liquidityBalances[msg.sender] < liquidity) revert InsufficientLiquidity();
        
        amountMUSD = (liquidity * reserveMUSD) / totalLiquidity;
        amountRWA = (liquidity * reserveRWA) / totalLiquidity;
        
        if (amountMUSD == 0 || amountRWA == 0) revert InsufficientLiquidity();
        if (amountMUSD < minAmountMUSD || amountRWA < minAmountRWA) revert SlippageExceeded();
        
        liquidityBalances[msg.sender] -= liquidity;
        totalLiquidity -= liquidity;
        reserveMUSD -= amountMUSD;
        reserveRWA -= amountRWA;
        
        mUSD.transfer(msg.sender, amountMUSD);
        rwaToken.transfer(msg.sender, amountRWA);
        
        emit LiquidityRemoved(msg.sender, amountMUSD, amountRWA);
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

        uint256 amountInWithFee = amountIn * FEE_NUMERATOR;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * FEE_DENOMINATOR) + amountInWithFee;
        amountOut = numerator / denominator;
    }
}
