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

    IERC20 public collateralAsset;
    uint256 public mintPercentageBps;
    uint256 public collateralPriceUsd;

    mapping(address => uint256) public collateralBalances;
    mapping(address => uint256) public debtBalances;

    event CollateralAssetUpdated(address indexed asset);
    event MintPercentageUpdated(uint256 bps);
    event CollateralPriceUpdated(uint256 price);
    event CollateralLocked(address indexed account, uint256 collateralAmount, uint256 mintedAmount);
    event CollateralUnlocked(address indexed account, uint256 collateralAmount, uint256 burnedAmount);

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

        _burn(msg.sender, burnAmount);
        collateralAsset.transfer(msg.sender, amount);

        emit CollateralUnlocked(msg.sender, amount, burnAmount);
    }
}
