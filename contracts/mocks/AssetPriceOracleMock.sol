// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IAssetPriceOracle.sol";

contract AssetPriceOracleMock is IAssetPriceOracle {

    uint256 private _assetPrice;

    constructor() {
        setAssetPriceInternal(10**18);
    }

    function setAssetPriceInternal(uint256 assetPrice_) public {
        _assetPrice = assetPrice_;
    }

    function lpPrice() public view returns (uint256) {
        return _assetPrice;
    }
}
