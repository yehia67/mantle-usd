// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IMUSD} from "mUSD/interfaces/IMUSD.sol";
import {ISwapper} from "./ISwapper.sol";

interface ISuperStake {
    struct Position {
        uint256 collateralLocked;
        uint256 debtMUSD;
    }

    event TokensConfigured(address indexed mUsd, address indexed mEth);
    event SwapperUpdated(address indexed swapper);
    event MaxLoopsUpdated(uint8 maxLoops);
    event PositionOpened(address indexed user, uint256 collateralLocked, uint256 totalDebtMinted, uint8 loopsExecuted);
    event PositionClosed(address indexed user, uint256 collateralReleased, uint256 debtBurned);

    function setTokens(address mUsd_, address mEth_) external;
    function setSwapper(address swapper_) external;
    function setMaxLeverageLoops(uint8 newMax) external;

    function deposit(uint256 ethAmount, uint8 loops, bytes calldata swapData)
        external
        returns (uint256 collateralLocked, uint256 totalDebtMinted);

    function withdraw(uint256 ethAmount, bytes calldata swapData) external returns (uint256 musdReturned);
    function swapMusdForMeth(uint256 musdAmount, bytes calldata swapData) external returns (uint256 ethReceived);
    function swapMethForMusd(uint256 ethAmount, bytes calldata swapData) external returns (uint256 musdReceived);

    function getPosition(address account) external view returns (Position memory);
    function getUserPosition(address account) external view returns (uint256 collateral, uint256 debt);
    function previewDebtForCollateral(uint256 collateralAmount) external view returns (uint256);

    function mUsd() external view returns (IMUSD);
    function mEth() external view returns (IERC20);
    function swapper() external view returns (ISwapper);
    function maxLeverageLoops() external view returns (uint8);
}
