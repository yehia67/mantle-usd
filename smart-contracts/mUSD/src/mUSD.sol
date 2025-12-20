// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/// @title Mantle USD (mUSD)
/// @notice Minimal ERC20 token with owner-controlled mint and burn capabilities.
contract mUSD is ERC20, Ownable {
    constructor() ERC20("Mantle USD", "mUSD") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}
