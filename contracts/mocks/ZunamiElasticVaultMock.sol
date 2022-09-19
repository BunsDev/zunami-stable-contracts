// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../ZunamiElasticVault.sol';

contract ZunamiElasticVaultMock is ZunamiElasticVault {
    constructor(
        IERC20Metadata asset,
        address priceOracle,
        string memory name,
        string memory symbol
    ) ElasticERC20(name, symbol) ElasticVault(asset) ZunamiElasticVault(priceOracle) {}

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
