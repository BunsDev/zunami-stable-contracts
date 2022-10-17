// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../interfaces/IAssetPriceOracle.sol';

contract AssetPriceOracleMock is IAssetPriceOracle {
    uint256 private _assetPrice;
    uint256[] private _gasBurner;

    constructor() {
        setAssetPriceInternal(10**18);
    }

    function setAssetPriceInternal(uint256 assetPrice_) public {
        _assetPrice = assetPrice_;
    }

    function lpPrice() public view returns (uint256) {
        //burn extra gas
        uint mock = 0;
        for(uint256 i = 0; i < 1000; i++) {
            mock = uint256(keccak256(abi.encodePacked(block.number + i)));
        }

        return _assetPrice;
    }
}
