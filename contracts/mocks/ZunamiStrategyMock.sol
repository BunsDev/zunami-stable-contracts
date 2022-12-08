// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../interfaces/IZunamiStrategy.sol';

contract ZunamiStrategyMock is IZunamiStrategy {
    address[3] public tokens;

    constructor(address[3] memory _tokens) {
        tokens = _tokens;
    }

    function deposit(uint256[3] memory amounts) external returns (uint256) {
        require(
            IERC20(tokens[0]).balanceOf(address(this)) >= amounts[0] &&
                IERC20(tokens[1]).balanceOf(address(this)) >= amounts[1] &&
                IERC20(tokens[2]).balanceOf(address(this)) >= amounts[2]
        );
        return amounts[0] + amounts[1] + amounts[2];
    }
}
