// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../PricableAsset.sol';

contract PricableAssetMock is PricableAsset {
    uint256 public cachedAssetPrice;

    IAssetPriceOracle public priceOracle;

    constructor(address priceOracle_) {
        priceOracle = IAssetPriceOracle(priceOracle_);
    }

    function assetPrice() public view override returns (uint256) {
        return priceOracle.lpPrice();
    }

    function assetPriceCachedInternal() external {
        cachedAssetPrice = assetPriceCached();
    }
}
