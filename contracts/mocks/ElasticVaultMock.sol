// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../ElasticVault.sol';

contract ElasticVaultMock is ElasticVault {
    constructor(
        IERC20Metadata asset,
        address priceOracle,
        string memory name,
        string memory symbol
    ) ElasticERC20(name, symbol, priceOracle) ElasticVault(asset) {}

    function mockMint(
        address account,
        uint256 nominalAmount,
        uint256 amount
    ) public {
        _mint(account, nominalAmount, amount);
    }

    function mockBurn(
        address account,
        uint256 nominalAmount,
        uint256 amount
    ) public {
        _burn(account, nominalAmount, amount);
    }
}
