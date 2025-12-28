// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/**
 * @title IMUSD
 * @notice Interface for the mUSD stablecoin contract
 */
interface IMUSD is IERC20 {
    // Events
    event CollateralAssetUpdated(address indexed newCollateral);
    event MintPercentageUpdated(uint256 newPercentage);
    event CollateralPriceUpdated(uint256 newPrice);
    event MinHealthFactorUpdated(uint256 newFactor);
    event CollateralLocked(address indexed user, uint256 collateralAmount, uint256 mintedAmount);
    event CollateralUnlocked(address indexed user, uint256 collateralAmount, uint256 burnedAmount);
    event PositionLiquidated(
        address indexed account,
        address indexed liquidator,
        uint256 collateralSeized,
        uint256 debtBurned
    );

    // State variables (view functions)
    function collateralAsset() external view returns (IERC20);
    function mintPercentageBps() external view returns (uint256);
    function collateralPriceUsd() external view returns (uint256);
    function minHealthFactor() external view returns (uint256);
    function collateralBalances(address account) external view returns (uint256);
    function debtBalances(address account) external view returns (uint256);

    // Owner functions
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function setCollateralAsset(address newCollateral) external;
    function setMintPercentageBps(uint256 newPercentage) external;
    function setCollateralPriceUsd(uint256 price) external;
    function setMinHealthFactor(uint256 newFactor) external;

    // User functions
    function lockCollateral(uint256 amount) external;
    function unlockCollateral(uint256 amount) external;
    function liquidate(address account) external;

    // View functions
    function getHealthFactor(address account) external view returns (uint256);
    function isLiquidatable(address account) external view returns (bool);
}
