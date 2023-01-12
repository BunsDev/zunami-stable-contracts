import { waffle, artifacts, ethers } from 'hardhat';
import { expect } from 'chai';
import { MockContract } from 'ethereum-waffle';
import { Contract, ContractFactory, utils, Wallet } from 'ethers';
import { Artifact } from 'hardhat/types';

const { deployMockContract, provider } = waffle;

const { snapshot, time } = require('@openzeppelin/test-helpers');

describe('PricableAsset mock tests', async () => {
    let mockAssetPriceOracle: MockContract;
    let pricableAssetContract: Contract;
    let pricableAssetFactory: ContractFactory;
    let snap: any;

    beforeEach(async () => {
        snap = await snapshot();

        const wallet: Wallet = provider.getWallets()[0];
        const assetPriceOracleArtifact: Artifact = await artifacts.readArtifact(
            'IAssetPriceOracle'
        );
        const pricableAssetArtifact: Artifact = await artifacts.readArtifact('PricableAssetMock');

        mockAssetPriceOracle = await deployMockContract(wallet, assetPriceOracleArtifact.abi);

        pricableAssetFactory = new ContractFactory(
            pricableAssetArtifact.abi,
            pricableAssetArtifact.bytecode,
            wallet
        );

        pricableAssetContract = await pricableAssetFactory.deploy(mockAssetPriceOracle.address);
    });

    afterEach(async function () {
        await snap.restore();
    })

    it('should get asset price', async () => {
        await mockAssetPriceOracle.mock.lpPrice.returns(utils.parseEther('555'));
        expect(await pricableAssetContract.assetPrice()).to.eq(utils.parseEther('555'));
    });

    // it('should return cached price when current price decreased ', async () => {
    //     const initialPrice = utils.parseEther('555');
    //
    //     // Init price
    //     await mockAssetPriceOracle.mock.lpPrice.returns(initialPrice);
    //     await expect(pricableAssetContract.cacheAssetPrice())
    //         .to.emit(pricableAssetContract, 'CachedAssetPrice')
    //         .withArgs((await provider.getBlockNumber()) + 1, initialPrice);
    //
    //     // Decrease price
    //     const newPrice = utils.parseEther('444');
    //     await mockAssetPriceOracle.mock.lpPrice.returns(newPrice);
    //
    //     // Should return cached price
    //     await pricableAssetContract.cacheAssetPrice();
    //     expect(await pricableAssetContract.assetPriceCached()).to.eq(initialPrice);
    // });

    // In this case block numbers are different, _c_cachedBlock = 0 but block.number > 0
    it('should return initial zero price for operations in one block', async () => {
        // Fix a block
        ethers.provider.send('evm_setAutomine', [false]);
        ethers.provider.send('evm_setIntervalMining', [0]);
        const initialBlockNumber = await provider.getBlockNumber();
        const initialPrice = await pricableAssetContract.assetPriceCached();

        // Change price
        const cachedPrice = utils.parseEther('555');
        await mockAssetPriceOracle.mock.lpPrice.returns(cachedPrice);
        await pricableAssetContract.cacheAssetPrice();
        const currentBlockNumber = await provider.getBlockNumber();

        // Should be same block and cached price
        expect(currentBlockNumber).to.eq(initialBlockNumber);
        expect(await pricableAssetContract.assetPriceCached()).to.eq(initialPrice);

        ethers.provider.send('evm_setAutomine', [true]);
    });

    // In this case block numbers are different
    it('should return cached price for operations in one block', async () => {
        const initPrice = utils.parseEther('555');
        await mockAssetPriceOracle.mock.lpPrice.returns(initPrice);
        await pricableAssetContract.cacheAssetPrice();

        // Fix a block
        ethers.provider.send('evm_setAutomine', [false]);
        ethers.provider.send('evm_setIntervalMining', [0]);
        const initialBlockNumber = await provider.getBlockNumber();
        const currentPrice = await pricableAssetContract.assetPriceCached();

        // Change price
        const newPrice = utils.parseEther('444');
        await mockAssetPriceOracle.mock.lpPrice.returns(newPrice);
        await pricableAssetContract.cacheAssetPrice();

        const currentBlockNumber = await provider.getBlockNumber();

        // Should be same block and cached price
        expect(currentBlockNumber).to.eq(initialBlockNumber);
        expect(await pricableAssetContract.assetPriceCached()).to.eq(currentPrice);

        ethers.provider.send('evm_setAutomine', [true]);
    });

    // In this case block numbers are equals
    it('should return cached price when block numbers are equals', async () => {
        // Fix a block
        ethers.provider.send('evm_setAutomine', [false]);
        ethers.provider.send('evm_setIntervalMining', [0]);
        const initPrice = utils.parseEther('555');
        await mockAssetPriceOracle.mock.lpPrice.returns(initPrice);
        await pricableAssetContract.cacheAssetPrice();
        const initialBlockNumber = await provider.getBlockNumber();
        const currentPrice = await pricableAssetContract.assetPriceCached();

        // Change price
        const newPrice = utils.parseEther('444');
        await mockAssetPriceOracle.mock.lpPrice.returns(newPrice);
        await pricableAssetContract.cacheAssetPrice();

        const currentBlockNumber = await provider.getBlockNumber();

        // Should be same block and cached price
        expect(currentBlockNumber).to.eq(initialBlockNumber);
        expect(await pricableAssetContract.assetPriceCached()).to.eq(currentPrice);

        ethers.provider.send('evm_setAutomine', [true]);
    });

    it('should return new cached price when cache duration are passed', async () => {
        const initPrice = utils.parseEther('555');
        await mockAssetPriceOracle.mock.lpPrice.returns(initPrice);
        await pricableAssetContract.cacheAssetPriceByBlockInternal();
        expect(await pricableAssetContract.assetPriceCached()).to.eq(initPrice);

        // Change price
        const newPrice = utils.parseEther('666');
        await mockAssetPriceOracle.mock.lpPrice.returns(newPrice);

        await pricableAssetContract.cacheAssetPriceByBlockInternal();
        expect(await pricableAssetContract.assetPriceCached()).to.eq(initPrice);

        const blockDuration = 10;
        await pricableAssetContract.setAssetPriceCacheDuration(blockDuration);

        for (let i = 0; i < blockDuration; i++) await time.advanceBlock();

        await pricableAssetContract.cacheAssetPriceByBlockInternal();
        expect(await pricableAssetContract.assetPriceCached()).to.eq(newPrice);
    });
});
