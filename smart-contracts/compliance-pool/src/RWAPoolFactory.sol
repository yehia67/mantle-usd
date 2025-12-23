// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {RWAPool} from "./RWAPool.sol";

/// @title RWAPoolFactory
/// @notice Factory contract for deploying compliant RWA liquidity pools
/// @dev Pools are permissionless to deploy but permissioned to swap (via RISC Zero proofs)
contract RWAPoolFactory {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Array of all deployed pool addresses
    address[] public allPools;

    /// @notice Mapping from pool address to deployment index
    mapping(address => uint256) public poolIndex;

    /// @notice Mapping to check if an address is a valid pool
    mapping(address => bool) public isPool;

    /// @notice Mapping from token pair to pool address
    /// @dev Key: keccak256(abi.encodePacked(token0, token1)) where token0 < token1
    mapping(bytes32 => address) public getPool;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a new pool is created
    /// @param pool Address of the newly created pool
    /// @param mUSD Address of mUSD token
    /// @param rwaToken Address of RWA token
    /// @param verifier Address of RISC Zero verifier
    /// @param imageId Allowed RISC Zero image ID
    /// @param poolIndex Index of the pool in allPools array
    event PoolCreated(
        address indexed pool,
        address indexed mUSD,
        address indexed rwaToken,
        address verifier,
        bytes32 imageId,
        uint256 poolIndex
    );

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error ZeroAddress();
    error InvalidImageId();
    error PoolAlreadyExists();
    error IdenticalAddresses();

    /*//////////////////////////////////////////////////////////////
                            FACTORY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Deploy a new RWA liquidity pool
    /// @param _mUSD Address of mUSD stablecoin
    /// @param _rwaToken Address of RWA token
    /// @param _verifier Address of RISC Zero verifier contract
    /// @param _allowedImageId Allowed RISC Zero image ID for compliance proofs
    /// @return pool Address of the newly deployed pool
    function createPool(address _mUSD, address _rwaToken, address _verifier, bytes32 _allowedImageId)
        external
        returns (address pool)
    {
        // Validation
        if (_mUSD == address(0) || _rwaToken == address(0) || _verifier == address(0)) {
            revert ZeroAddress();
        }
        if (_allowedImageId == bytes32(0)) revert InvalidImageId();
        if (_mUSD == _rwaToken) revert IdenticalAddresses();

        // Check if pool already exists
        bytes32 pairKey = _getPairKey(_mUSD, _rwaToken);
        if (getPool[pairKey] != address(0)) revert PoolAlreadyExists();

        // Deploy new pool
        pool = address(new RWAPool(_mUSD, _rwaToken, _verifier, _allowedImageId));

        // Store pool data
        uint256 index = allPools.length;
        allPools.push(pool);
        poolIndex[pool] = index;
        isPool[pool] = true;
        getPool[pairKey] = pool;

        emit PoolCreated(pool, _mUSD, _rwaToken, _verifier, _allowedImageId, index);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get total number of deployed pools
    function allPoolsLength() external view returns (uint256) {
        return allPools.length;
    }

    /// @notice Get pool address by index
    /// @param index Index in the allPools array
    function getPoolAtIndex(uint256 index) external view returns (address) {
        require(index < allPools.length, "Index out of bounds");
        return allPools[index];
    }

    /// @notice Get pool address for a token pair
    /// @param tokenA First token address
    /// @param tokenB Second token address
    /// @return pool Pool address (address(0) if doesn't exist)
    function getPoolByPair(address tokenA, address tokenB) external view returns (address pool) {
        bytes32 pairKey = _getPairKey(tokenA, tokenB);
        return getPool[pairKey];
    }

    /// @notice Get all deployed pool addresses
    function getAllPools() external view returns (address[] memory) {
        return allPools;
    }

    /*//////////////////////////////////////////////////////////////
                            INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Generate deterministic key for token pair
    /// @dev Orders tokens to ensure consistent key regardless of input order
    function _getPairKey(address tokenA, address tokenB) internal pure returns (bytes32) {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        return keccak256(abi.encodePacked(token0, token1));
    }
}
