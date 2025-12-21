// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/// @title Mantle USD (mUSD)
/// @notice ERC20 stablecoin with owner controls plus collateral-backed mint/burn flows.
contract mUSD is ERC20, Ownable {
    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant PRICE_SCALE = 1e18;
    uint256 public constant MIN_HEALTH_FACTOR = 1_500; // 1.5x (150% collateralization minimum)

    IERC20 public collateralAsset;
    uint256 public mintPercentageBps;
    uint256 public collateralPriceUsd;
    uint256 public minHealthFactor = 1_500;

    mapping(address => uint256) public collateralBalances;
    mapping(address => uint256) public debtBalances;

    event CollateralAssetUpdated(address indexed asset);
    event MintPercentageUpdated(uint256 bps);
    event CollateralPriceUpdated(uint256 price);
    event MinHealthFactorUpdated(uint256 newFactor);
    event CollateralLocked(address indexed account, uint256 collateralAmount, uint256 mintedAmount);
    event CollateralUnlocked(address indexed account, uint256 collateralAmount, uint256 burnedAmount);
    event PositionLiquidated(address indexed account, uint256 collateralSeized, uint256 debtBurned);

    constructor() ERC20("Mantle USD", "mUSD") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

    function setCollateralAsset(address newCollateral) external onlyOwner {
        require(newCollateral != address(0), "collateral zero");
        collateralAsset = IERC20(newCollateral);
        emit CollateralAssetUpdated(newCollateral);
    }

    function setMintPercentageBps(uint256 newPercentage) external onlyOwner {
        require(newPercentage <= BPS_DENOMINATOR, "percentage too high");
        mintPercentageBps = newPercentage;
        emit MintPercentageUpdated(newPercentage);
    }

    /// @notice Sets the collateral price in USD terms (1e18 precision). TODO: replace with oracle feed.
    function setCollateralPriceUsd(uint256 price) external onlyOwner {
        require(price > 0, "price zero");
        collateralPriceUsd = price;
        emit CollateralPriceUpdated(price);
    }

    function setMinHealthFactor(uint256 newFactor) external onlyOwner {
        require(newFactor > 0, "factor zero");
        minHealthFactor = newFactor;
        emit MinHealthFactorUpdated(newFactor);
    }

    function lockCollateral(uint256 amount) external {
        require(address(collateralAsset) != address(0), "collateral not set");
        require(mintPercentageBps > 0, "percentage not set");
        require(collateralPriceUsd > 0, "price not set");
        require(amount > 0, "amount zero");

        collateralAsset.transferFrom(msg.sender, address(this), amount);

        uint256 collateralValueUsd = (amount * collateralPriceUsd) / PRICE_SCALE;
        uint256 mintAmount = (collateralValueUsd * mintPercentageBps) / BPS_DENOMINATOR;
        require(mintAmount > 0, "mint zero");

        collateralBalances[msg.sender] += amount;
        debtBalances[msg.sender] += mintAmount;

        _mint(msg.sender, mintAmount);

        emit CollateralLocked(msg.sender, amount, mintAmount);
    }

    function unlockCollateral(uint256 amount) external {
        require(amount > 0, "amount zero");
        require(collateralBalances[msg.sender] >= amount, "insufficient collateral");

        uint256 collateralValueUsd = (amount * collateralPriceUsd) / PRICE_SCALE;
        uint256 burnAmount = (collateralValueUsd * mintPercentageBps) / BPS_DENOMINATOR;
        require(burnAmount > 0, "burn zero");
        require(debtBalances[msg.sender] >= burnAmount, "insufficient debt");

        collateralBalances[msg.sender] -= amount;
        debtBalances[msg.sender] -= burnAmount;

        uint256 remainingCollateralValue = (collateralBalances[msg.sender] * collateralPriceUsd) / PRICE_SCALE;
        uint256 remainingDebt = debtBalances[msg.sender];
        if (remainingDebt > 0) {
            uint256 healthFactor = (remainingCollateralValue * BPS_DENOMINATOR) / remainingDebt;
            require(healthFactor >= minHealthFactor, "health factor too low");
        }

        _burn(msg.sender, burnAmount);
        collateralAsset.transfer(msg.sender, amount);

        emit CollateralUnlocked(msg.sender, amount, burnAmount);
    }

    function liquidate(address account) external {
        require(account != address(0), "account zero");
        require(collateralBalances[account] > 0, "no collateral");
        require(debtBalances[account] > 0, "no debt");

        uint256 collateral = collateralBalances[account];
        uint256 debt = debtBalances[account];
        uint256 collateralValueUsd = (collateral * collateralPriceUsd) / PRICE_SCALE;
        uint256 requiredCollateralValue = (debt * BPS_DENOMINATOR) / mintPercentageBps;

        require(collateralValueUsd < requiredCollateralValue, "position healthy");

        collateralBalances[account] = 0;
        debtBalances[account] = 0;

        _burn(msg.sender, debt);

        emit PositionLiquidated(account, collateral, debt);
    }

    function withdrawLiquidatedCollateral(uint256 amount) external onlyOwner {
        collateralAsset.transfer(msg.sender, amount);
    }

    function getHealthFactor(address account) external view returns (uint256) {
        uint256 debt = debtBalances[account];
        if (debt == 0) return type(uint256).max;

        uint256 collateralValueUsd = (collateralBalances[account] * collateralPriceUsd) / PRICE_SCALE;
        return (collateralValueUsd * BPS_DENOMINATOR) / debt;
    }

    function isLiquidatable(address account) external view returns (bool) {
        uint256 collateral = collateralBalances[account];
        uint256 debt = debtBalances[account];
        if (debt == 0 || collateral == 0) return false;

        uint256 collateralValueUsd = (collateral * collateralPriceUsd) / PRICE_SCALE;
        uint256 requiredCollateralValue = (debt * BPS_DENOMINATOR) / mintPercentageBps;
        return collateralValueUsd < requiredCollateralValue;
    }
}
