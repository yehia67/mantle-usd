// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

interface IMUSD is IERC20 {
    function lockCollateral(uint256 amount) external;
    function unlockCollateral(uint256 amount) external;
    function collateralAsset() external view returns (IERC20);
    function collateralBalances(address account) external view returns (uint256);
    function debtBalances(address account) external view returns (uint256);
    function mintPercentageBps() external view returns (uint256);
    function collateralPriceUsd() external view returns (uint256);
}

interface ISwapper {
    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes calldata data)
        external
        returns (uint256 amountOut);
}

/// @title SuperStake
/// @notice Leverage protocol: lock mETH, mint mUSD, swap to mETH, repeat. All collateral held in contract.
contract SuperStake is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeERC20 for IMUSD;

    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant PRICE_SCALE = 1e18;

    struct Position {
        uint256 collateralLocked;
        uint256 debtMUSD;
    }

    IMUSD public mUsd;
    IERC20 public mEth;
    ISwapper public swapper;
    uint8 public maxLeverageLoops = 3;

    mapping(address => Position) private positions;

    event TokensConfigured(address indexed mUsd, address indexed mEth);
    event SwapperUpdated(address indexed swapper);
    event MaxLoopsUpdated(uint8 maxLoops);
    event PositionOpened(address indexed user, uint256 collateralLocked, uint256 totalDebtMinted, uint8 loopsExecuted);
    event PositionClosed(address indexed user, uint256 collateralReleased, uint256 debtBurned);

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

        Position storage position = positions[msg.sender];
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
        Position storage position = positions[msg.sender];
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

    /*//////////////////////////////////////////////////////////////
                              VIEW HELPERS
    //////////////////////////////////////////////////////////////*/

    function getPosition(address account) external view returns (Position memory) {
        return positions[account];
    }

    function previewDebtForCollateral(uint256 collateralAmount) external view returns (uint256) {
        return _calculateDebtForCollateral(collateralAmount);
    }

    function previewWithdrawal(address account, uint256 ethAmount) external view returns (uint256 estimatedDebtToBurn, uint256 iterations) {
        require(ethAmount > 0, "amount zero");
        Position memory pos = positions[account];
        require(ethAmount <= pos.collateralLocked, "insufficient collateral");
        
        uint256 totalDebt = 0;
        uint256 remaining = ethAmount;
        uint256 currentDebt = mUsd.debtBalances(address(this));
        
        for (uint256 i = 0; i < maxLeverageLoops + 1 && remaining > 0; ++i) {
            if (currentDebt == 0) break;
            
            uint256 unlockAmount = remaining;
            uint256 requiredDebt = _calculateDebtForCollateral(unlockAmount);
            
            if (requiredDebt > currentDebt) {
                unlockAmount = (currentDebt * PRICE_SCALE * BPS_DENOMINATOR) / (mUsd.collateralPriceUsd() * mUsd.mintPercentageBps());
                if (unlockAmount == 0) break;
                requiredDebt = currentDebt;
            }
            
            totalDebt += requiredDebt;
            remaining -= unlockAmount;
            currentDebt -= requiredDebt;
            iterations++;
        }
        
        estimatedDebtToBurn = totalDebt;
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
        return ((collateralAmount * price) / PRICE_SCALE) * percentage / BPS_DENOMINATOR;
    }
}
