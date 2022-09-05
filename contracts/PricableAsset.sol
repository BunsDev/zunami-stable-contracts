// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import './interfaces/IAssetPriceOracle.sol';

contract PricableAsset is Ownable {
    uint256 private _cachedBlock;
    uint256 private _cachedAssetPrice;

    IAssetPriceOracle public priceOracle;

    event CachedAssetPrice(uint256 blockNumber, uint256 assetPrice);

    constructor(address priceOracle_) {
        changePriceOracle(priceOracle_);
    }

    function changePriceOracle(address priceOracle_) public onlyOwner {
        require(priceOracle_ != address(0), 'Zero price oracle');
        priceOracle = IAssetPriceOracle(priceOracle_);
    }

    function assetPrice() public view returns (uint256) {
        return
            _cachedBlock > 0 && _cachedAssetPrice > 0 ? _cachedAssetPrice : priceOracle.lpPrice();
    }

    function assetPriceCached() public returns (uint256) {
        if (block.number != _cachedBlock) {
            _cachedBlock = block.number;
            uint256 currentAssetPrice = assetPrice();
            if (_cachedAssetPrice < currentAssetPrice) {
                _cachedAssetPrice = assetPrice();
                emit CachedAssetPrice(_cachedBlock, _cachedAssetPrice);
            }
        }

        return _cachedAssetPrice;
    }
}
