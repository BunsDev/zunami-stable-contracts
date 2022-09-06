// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../ElasticERC20.sol";

// mock class using ERC20
contract ElasticERC20Mock is ElasticERC20 {
    constructor(
        string memory name,
        string memory symbol,
        address priceOracle,
        address initialAccount,
        uint256 initialNominalBalance,
        uint256 initialBalance
    ) payable ElasticERC20(name, symbol, priceOracle) {
        if(initialAccount != address(0)) {
            _mint(initialAccount, initialNominalBalance, initialBalance);
        }
    }

    function mint(address account, uint256 nominalAmount, uint256 amount) public {
        _mint(account, nominalAmount, amount);
    }

    function burn(address account, uint256 nominalAmount, uint256 amount) public {
        _burn(account, nominalAmount, amount);
    }

    function transferInternal(
        address from,
        address to,
        uint256 nominalAmount,
        uint256 value
    ) public {
        _transfer(from, to, nominalAmount, value);
    }

    function approveInternal(
        address owner,
        address spender,
        uint256 value
    ) public {
        _approve(owner, spender, value);
    }
}
