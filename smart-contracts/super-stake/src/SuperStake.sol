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
/// @notice Automates leverage loops by locking mETH in mUSD, minting mUSD debt, swapping to mETH, and repeating.
contract SuperStake is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeERC20 for IMUSD;

    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant PRICE_SCALE = 1e18;
    uint256 private constant MAX_LEVERAGE_RATIO = 5 * PRICE_SCALE; // 5x max leverage

    struct Position {
        uint256 collateralLocked;
        uint256 debtMUSD;
    }

    IMUSD public mUsd;
    IERC20 public mEth;
    ISwapper public swapper;
    uint8 public maxLeverageLoops = 3;

    mapping(address => Position) private positions;

    event TokensConfigured(address mUsd, address mEth);
    event SwapperUpdated(address swapper);
    event MaxLoopsUpdated(uint8 maxLoops);
    event PositionLeveraged(address indexed account, uint256 collateralAdded, uint256 debtMinted, uint8 loopsExecuted);
    event DebtRepaid(address indexed account, uint256 debtBurned, uint256 collateralReleased);

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

    function depositWithMETH(uint256 amount, uint8 loops, uint256 minSwapOut, bytes calldata swapData)
        external
        nonReentrant
        returns (uint256 collateralAdded, uint256 debtMinted)
    {
        _validateConfig(loops);
        require(amount > 0, "amount zero");

        mEth.safeTransferFrom(msg.sender, address(this), amount);
        (collateralAdded, debtMinted) = _leverAndLock(msg.sender, amount, loops, minSwapOut, swapData);
    }

    function depositWithMUSD(uint256 amount, uint8 loops, uint256 minSwapOut, bytes calldata swapData)
        external
        nonReentrant
        returns (uint256 collateralAdded, uint256 debtMinted)
    {
        _validateConfig(loops);
        require(amount > 0, "amount zero");

        mUsd.safeTransferFrom(msg.sender, address(this), amount);
        uint256 baseEth = _swap(address(mUsd), address(mEth), amount, minSwapOut, swapData);
        (collateralAdded, debtMinted) = _leverAndLock(msg.sender, baseEth, loops, minSwapOut, swapData);
    }

    function repayAndUnlock(uint256 collateralAmount, uint256 maxRepayAmount)
        external
        nonReentrant
        returns (uint256 burnedDebt)
    {
        require(collateralAmount > 0, "amount zero");
        Position storage position = positions[msg.sender];
        require(collateralAmount <= position.collateralLocked, "collateral exceeded");
        require(maxRepayAmount > 0, "max repay zero");

        uint256 previewDebt = _previewDebt(collateralAmount);
        require(maxRepayAmount >= previewDebt, "repay insufficient");

        mUsd.safeTransferFrom(msg.sender, address(this), maxRepayAmount);

        uint256 debtBefore = mUsd.debtBalances(address(this));
        mUsd.unlockCollateral(collateralAmount);
        uint256 debtAfter = mUsd.debtBalances(address(this));

        burnedDebt = debtBefore - debtAfter;
        require(burnedDebt > 0, "burn zero");

        if (maxRepayAmount > burnedDebt) {
            mUsd.safeTransfer(msg.sender, maxRepayAmount - burnedDebt);
        }

        position.collateralLocked -= collateralAmount;
        position.debtMUSD -= burnedDebt;

        mEth.safeTransfer(msg.sender, collateralAmount);
        emit DebtRepaid(msg.sender, burnedDebt, collateralAmount);
    }

    /*//////////////////////////////////////////////////////////////
                              VIEW HELPERS
    //////////////////////////////////////////////////////////////*/

    function getPosition(address account) external view returns (Position memory) {
        return positions[account];
    }

    function previewDebtForCollateral(uint256 collateralAmount) external view returns (uint256) {
        return _previewDebt(collateralAmount);
    }

    /*//////////////////////////////////////////////////////////////
                              INTERNALS
    //////////////////////////////////////////////////////////////*/

    function _leverAndLock(address account, uint256 baseCollateral, uint8 loops, uint256 minSwapOut, bytes calldata swapData)
        internal
        returns (uint256 totalCollateralLocked, uint256 totalDebtMinted)
    {
        require(address(swapper) != address(0), "swapper unset");
        require(address(mUsd) != address(0) && address(mEth) != address(0), "tokens unset");
        require(loops > 0, "loops zero");

        uint256 collateralPortion = baseCollateral;

        for (uint8 i = 0; i < loops; ++i) {
            uint256 minted = _lockCollateral(collateralPortion);
            totalCollateralLocked += collateralPortion;
            totalDebtMinted += minted;

            // Swap minted mUSD to mETH for next iteration
            collateralPortion = _swap(address(mUsd), address(mEth), minted, minSwapOut, swapData);
            require(collateralPortion > 0, "swap zero");
        }

        Position storage position = positions[account];
        position.collateralLocked += totalCollateralLocked;
        position.debtMUSD += totalDebtMinted;

        emit PositionLeveraged(account, totalCollateralLocked, totalDebtMinted, loops);
    }

    function _lockCollateral(uint256 amount) internal returns (uint256 mintedAmount) {
        require(amount > 0, "amount zero");

        IERC20 collateralToken = mUsd.collateralAsset();
        require(address(collateralToken) == address(mEth), "collateral mismatch");

        mEth.safeIncreaseAllowance(address(mUsd), amount);

        uint256 debtBefore = mUsd.debtBalances(address(this));
        mUsd.lockCollateral(amount);
        uint256 debtAfter = mUsd.debtBalances(address(this));

        mintedAmount = debtAfter - debtBefore;
        mEth.forceApprove(address(mUsd), 0);
        require(mintedAmount > 0, "mint zero");
    }

    function _swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes calldata data)
        internal
        returns (uint256 amountOut)
    {
        if (amountIn == 0) return 0;
        IERC20(tokenIn).safeIncreaseAllowance(address(swapper), amountIn);
        amountOut = swapper.swap(tokenIn, tokenOut, amountIn, minAmountOut, data);
        IERC20(tokenIn).forceApprove(address(swapper), 0);
        require(amountOut >= minAmountOut, "slippage");
    }

    function _previewDebt(uint256 collateralAmount) internal view returns (uint256) {
        if (collateralAmount == 0) return 0;
        uint256 price = mUsd.collateralPriceUsd();
        uint256 percentage = mUsd.mintPercentageBps();
        return ((collateralAmount * price) / PRICE_SCALE) * percentage / BPS_DENOMINATOR;
    }

    function _validateConfig(uint8 loops) internal view {
        require(loops <= maxLeverageLoops, "loops exceed limit");
    }
}
