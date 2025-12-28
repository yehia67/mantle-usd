// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {IMUSD} from "mUSD/interfaces/IMUSD.sol";
import {ISwapper} from "./interfaces/ISwapper.sol";
import {ISuperStake} from "./interfaces/ISuperStake.sol";

/// @title SuperStake
/// @notice Leverage helper: provides swap services for mETH leverage loops.
/// @dev Users own positions directly in mUSD. SuperStake only facilitates swaps between mUSD and mETH.
contract SuperStake is ISuperStake, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeERC20 for IMUSD;

    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant PRICE_SCALE = 1e18;

    IMUSD public mUsd;
    IERC20 public mEth;
    ISwapper public swapper;
    uint8 public maxLeverageLoops = 3;

    mapping(address => ISuperStake.Position) private positions;

    constructor() Ownable(msg.sender) {}

    /*//////////////////////////////////////////////////////////////
                            ADMIN CONFIG
    //////////////////////////////////////////////////////////////*/

    function setTokens(address mUsd_, address mEth_) external onlyOwner {
        require(mUsd_ != address(0) && mEth_ != address(0), "tokens zero");
        mUsd = IMUSD(mUsd_);
        mEth = IERC20(mEth_);
        emit TokensConfigured(mUsd_, mEth_);
    }

    function setSwapper(address swapper_) external onlyOwner {
        require(swapper_ != address(0), "swapper zero");
        swapper = ISwapper(swapper_);
        emit SwapperUpdated(swapper_);
    }

    function setMaxLeverageLoops(uint8 newMax) external onlyOwner {
        maxLeverageLoops = newMax;
        emit MaxLoopsUpdated(newMax);
    }

    /*//////////////////////////////////////////////////////////////
                              USER FLOWS
    //////////////////////////////////////////////////////////////*/

    function deposit(uint256 ethAmount, uint8 loops, bytes calldata swapData)
        external
        nonReentrant
        returns (uint256 collateralLocked, uint256 totalDebtMinted)
    {
        require(ethAmount > 0, "amount zero");
        require(loops > 0 && loops <= maxLeverageLoops, "loops must be between 1 and max");
        require(address(swapper) != address(0), "swapper unset");
        require(address(mUsd) != address(0) && address(mEth) != address(0), "tokens unset");

        mEth.safeTransferFrom(msg.sender, address(this), ethAmount);

        collateralLocked = ethAmount;
        totalDebtMinted = _lockAndMint(ethAmount);

        uint256 currentDebt = totalDebtMinted;
        for (uint8 i = 0; i < loops; ++i) {
            uint256 ethReceived = _swapMusdToEth(currentDebt, swapData);
            collateralLocked += ethReceived;
            
            currentDebt = _lockAndMint(ethReceived);
            totalDebtMinted += currentDebt;
        }

        uint256 remainingMusd = mUsd.balanceOf(address(this));
        if (remainingMusd > 0) {
            uint256 finalEthReceived = _swapMusdToEth(remainingMusd, swapData);
            collateralLocked += finalEthReceived;
            uint256 finalDebt = _lockAndMint(finalEthReceived);
            totalDebtMinted += finalDebt;
        }

        ISuperStake.Position storage position = positions[msg.sender];
        position.collateralLocked += collateralLocked;
        position.debtMUSD += totalDebtMinted;

        emit PositionOpened(msg.sender, collateralLocked, totalDebtMinted, loops);
    }

    function withdraw(uint256 ethAmount, bytes calldata swapData)
        external
        nonReentrant
        returns (uint256 musdReturned)
    {
        require(ethAmount > 0, "amount zero");
        ISuperStake.Position storage position = positions[msg.sender];
        require(ethAmount <= position.collateralLocked, "insufficient collateral");
        require(address(swapper) != address(0), "swapper unset");

        uint256 debtToBurn = _calculateDebtForCollateral(ethAmount);
        require(debtToBurn <= position.debtMUSD, "debt calculation error");
        
        mUsd.safeTransferFrom(msg.sender, address(this), debtToBurn);
        
        mUsd.unlockCollateral(ethAmount);
        
        uint256 musdReceived = _swapMethToMusd(ethAmount, swapData);
        
        position.collateralLocked -= ethAmount;
        position.debtMUSD -= debtToBurn;
        
        musdReturned = musdReceived;
        mUsd.safeTransfer(msg.sender, musdReturned);
        
        emit PositionClosed(msg.sender, ethAmount, debtToBurn);
    }

    function swapMusdForMeth(uint256 musdAmount, bytes calldata swapData)
        external
        nonReentrant
        returns (uint256 ethReceived)
    {
        require(musdAmount > 0, "amount zero");
        require(address(swapper) != address(0), "swapper unset");

        mUsd.safeTransferFrom(msg.sender, address(this), musdAmount);
        ethReceived = _swapMusdToEth(musdAmount, swapData);
        mEth.safeTransfer(msg.sender, ethReceived);
    }

    function swapMethForMusd(uint256 ethAmount, bytes calldata swapData)
        external
        nonReentrant
        returns (uint256 musdReceived)
    {
        require(ethAmount > 0, "amount zero");
        require(address(swapper) != address(0), "swapper unset");

        mEth.safeTransferFrom(msg.sender, address(this), ethAmount);
        musdReceived = _swapMethToMusd(ethAmount, swapData);
        mUsd.safeTransfer(msg.sender, musdReceived);
    }

    /*//////////////////////////////////////////////////////////////
                              VIEW HELPERS
    //////////////////////////////////////////////////////////////*/

    function getPosition(address account) external view returns (ISuperStake.Position memory) {
        return positions[account];
    }

    function getUserPosition(address account) external view returns (uint256 collateral, uint256 debt) {
        collateral = mUsd.collateralBalances(account);
        debt = mUsd.debtBalances(account);
    }

    function previewDebtForCollateral(uint256 collateralAmount) external view returns (uint256) {
        return _calculateDebtForCollateral(collateralAmount);
    }

    /*//////////////////////////////////////////////////////////////
                              INTERNALS
    //////////////////////////////////////////////////////////////*/

    function _lockAndMint(uint256 ethAmount) internal returns (uint256 totalDebtMinted) {
        require(ethAmount > 0, "amount zero");

        mEth.approve(address(mUsd), ethAmount);
        uint256 debtBefore = mUsd.debtBalances(address(this));
        mUsd.lockCollateral(ethAmount);
        uint256 debtAfter = mUsd.debtBalances(address(this));

        totalDebtMinted = debtAfter - debtBefore;
        require(totalDebtMinted > 0, "mint zero");
    }

    function _swapMusdToEth(uint256 musdAmount, bytes calldata swapData) internal returns (uint256 ethReceived) {
        require(musdAmount > 0, "amount zero");

        mUsd.approve(address(swapper), musdAmount);
        ethReceived = swapper.swap(address(mUsd), address(mEth), musdAmount, 0, swapData);
        require(ethReceived > 0, "swap zero");
    }

    function _swapMethToMusd(uint256 ethAmount, bytes calldata swapData) internal returns (uint256 musdReceived) {
        require(ethAmount > 0, "amount zero");

        mEth.approve(address(swapper), ethAmount);
        musdReceived = swapper.swap(address(mEth), address(mUsd), ethAmount, 0, swapData);
        require(musdReceived > 0, "swap zero");
    }

    function _calculateDebtForCollateral(uint256 collateralAmount) internal view returns (uint256) {
        if (collateralAmount == 0) return 0;
        uint256 price = mUsd.collateralPriceUsd();
        uint256 percentage = mUsd.mintPercentageBps();
        // Returns debt in 6 decimals (mUSD decimals)
        // collateralAmount (18 decimals) * price (18 decimals) / 1e18 = USD value (18 decimals)
        // USD value * percentage / 10_000 = debt in 18 decimals
        // Convert to 6 decimals: / 1e12
        return (((collateralAmount * price) / PRICE_SCALE) * percentage / BPS_DENOMINATOR) / 1e12;
    }
}
