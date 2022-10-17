// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../PricableAsset.sol';

contract PricableAssetMock is PricableAsset {
    IAssetPriceOracle public priceOracle;
    uint256 private _assetPriceCacheDuration = 280;

    constructor(address priceOracle_) PricableAsset() {
        priceOracle = IAssetPriceOracle(priceOracle_);
    }

    function assetPrice() public view override returns (uint256) {
        return priceOracle.lpPrice();
    }

    function assetPriceCacheDuration() public view override returns (uint256) {
        return _assetPriceCacheDuration;
    }

    function setAssetPriceCacheDuration(uint256 assetPriceCacheDuration_) public {
        _assetPriceCacheDuration = assetPriceCacheDuration_;
    }

    function cacheAssetPriceByBlockInternal() public {
        _cacheAssetPriceByBlock();
    }
}
