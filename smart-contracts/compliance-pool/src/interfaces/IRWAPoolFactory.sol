// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRWAPoolFactory {
    event PoolCreated(
        address indexed pool,
        address indexed mUSD,
        address indexed rwaToken,
        address verifier,
        bytes32 imageId,
        uint256 poolIndex
    );

    error ZeroAddress();
    error InvalidImageId();
    error PoolAlreadyExists();
    error IdenticalAddresses();
    error IndexOutOfBounds();

    function createPool(address _mUSD, address _rwaToken, address _verifier, bytes32 _allowedImageId)
        external
        returns (address pool);

    function allPoolsLength() external view returns (uint256);
    function getPoolAtIndex(uint256 index) external view returns (address);
    function getPoolByPair(address tokenA, address tokenB) external view returns (address pool);
    function getAllPools() external view returns (address[] memory);

    function allPools(uint256 index) external view returns (address);
    function poolIndex(address pool) external view returns (uint256);
    function isPool(address pool) external view returns (bool);
    function getPool(bytes32 key) external view returns (address);
}
