const { BN, constants, expectRevert, snapshot, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');

const ERC20DecimalsMock = artifacts.require('ERC20DecimalsMock');
const ZunamiElasticRigidVaultMock = artifacts.require('ZunamiElasticRigidVaultMock');
const AssetPriceOracleMock = artifacts.require('AssetPriceOracleMock');

const { waffle } = require('hardhat');
const { deployMockContract, provider } = waffle;
const [wallet, otherWallet] = provider.getWallets();

const mockContract = async (name) =>
    deployMockContract(wallet, (await artifacts.readArtifact(name)).abi);

const one = new BN(10).pow(new BN(18));
const zero = new BN(0);
const parseToken = (token) => new BN(token).mul(one);
const parseShare = (share) => new BN(share).mul(one);

contract('ZunamiElasticRigidVault', function (accounts) {
    const [holder, recipient, spender, other, user1, user2] = accounts;

    const name = 'My Token';
    const symbol = 'MTKN';

    const initialPrice = one.muln(1); // 1
    const updatedPrice = new BN('1500000000000000000'); // 1.5 * 10^18

    const initialValue = parseShare(150);
    const initialNominal = parseToken(100);

    let snap;

    beforeEach(async function () {
        snap = await snapshot();
        this.assetPricer = await AssetPriceOracleMock.new();
        await this.assetPricer.setAssetPriceInternal(initialPrice);
        this.token = await ERC20DecimalsMock.new(name, symbol, 18);
        this.vault = await ZunamiElasticRigidVaultMock.new(
            this.token.address,
            this.assetPricer.address,
            name + ' Vault',
            symbol + 'V'
        );

        await this.token.mint(holder, web3.utils.toWei('100'));
        await this.token.approve(this.vault.address, constants.MAX_UINT256, { from: holder });
        await this.vault.approve(spender, constants.MAX_UINT256, { from: holder });
        await this.assetPricer.setAssetPriceInternal(updatedPrice);
        await this.vault.cacheAssetPrice();

        await this.token.mint(this.vault.address, initialNominal);
        await this.vault.mockMint(holder, initialNominal, initialValue);
    });

    afterEach(async function () {
        await snap.restore();
    });

    it('metadata', async function () {
        expect(await this.vault.priceOracle()).to.be.equal(this.assetPricer.address);
        expect((await this.vault.assetPrice()).toString()).to.be.equal(updatedPrice.toString());

        const DEFAULT_ADMIN_ROLE = (await this.vault.DEFAULT_ADMIN_ROLE()).toString();
        const REBALANCER_ROLE = (await this.vault.REBALANCER_ROLE()).toString();
        expect(await this.vault.hasRole(DEFAULT_ADMIN_ROLE, holder)).to.be.true;
        expect(await this.vault.hasRole(REBALANCER_ROLE, holder)).to.be.false;

        expect(await this.vault.hasRole(DEFAULT_ADMIN_ROLE, other)).to.be.false;
        expect(await this.vault.hasRole(REBALANCER_ROLE, other)).to.be.false;
    });

    describe('fee', async function () {
        beforeEach(async function () {
            expect(await this.vault.balanceOf(holder)).to.be.bignumber.equal(initialValue);
            expect(await this.vault.balanceOfNominal(holder)).to.be.bignumber.equal(initialNominal);
        });

        it('percent should be changed', async function () {
            expect(await this.vault.withdrawFee()).to.be.bignumber.equal('0');
            await this.vault.changeWithdrawFee(50000);
            expect(await this.vault.withdrawFee()).to.be.bignumber.equal('50000');

            await expectRevert(this.vault.changeWithdrawFee(50001), 'Bigger that MAX_FEE constant');
        });

        it('distributor should be changed', async function () {
            expect(await this.vault.feeDistributor()).to.be.bignumber.equal(constants.ZERO_ADDRESS);
            await this.vault.changeFeeDistributor(other);
            expect(await this.vault.feeDistributor()).to.be.bignumber.equal(other);
        });

        it('should be withdraw all', async function () {
            await this.vault.changeWithdrawFee(10000); //1%
            await this.vault.changeFeeDistributor(other);

            expect(await this.vault.previewWithdraw(initialValue)).to.be.bignumber.equal(
                parseToken(99)
            );

            expect(await this.token.balanceOf(other)).to.be.bignumber.equal('0');
            expect(await this.token.balanceOf(recipient)).to.be.bignumber.equal('0');
            expect(await this.vault.balanceOf(holder)).to.be.bignumber.equal(initialValue);
            expect(await this.vault.balanceOfNominal(holder)).to.be.bignumber.equal(initialNominal);
            expect(await this.token.balanceOf(this.vault.address)).to.be.bignumber.equal(
                initialNominal
            );

            await this.vault.withdrawAll(recipient, holder, {
                from: holder,
            });

            expect(await this.token.balanceOf(other)).to.be.bignumber.equal(parseToken(1));
            expect(await this.token.balanceOf(recipient)).to.be.bignumber.equal(parseToken(99));
            expect(await this.vault.balanceOf(holder)).to.be.bignumber.equal('0');
            expect(await this.vault.balanceOfNominal(holder)).to.be.bignumber.equal('0');
            expect(await this.token.balanceOf(this.vault.address)).to.be.bignumber.equal('0');
        });

        it('should be withdraw', async function () {
            await this.vault.changeWithdrawFee(10000); //1%
            await this.vault.changeFeeDistributor(other);

            expect(await this.vault.previewWithdraw(initialNominal)).to.be.bignumber.equal(
                '66000000000000000000'
            );

            expect(await this.token.balanceOf(other)).to.be.bignumber.equal('0');
            expect(await this.token.balanceOf(recipient)).to.be.bignumber.equal('0');
            expect(await this.vault.balanceOf(holder)).to.be.bignumber.equal(initialValue);
            expect(await this.vault.balanceOfNominal(holder)).to.be.bignumber.equal(initialNominal);
            expect(await this.token.balanceOf(this.vault.address)).to.be.bignumber.equal(
                initialNominal
            );

            await this.vault.withdraw(initialNominal, recipient, holder, {
                from: holder,
            });

            expect(await this.token.balanceOf(other)).to.be.bignumber.equal('666666666666666666');
            expect(await this.token.balanceOf(recipient)).to.be.bignumber.equal(
                '66000000000000000000'
            );
            expect(await this.vault.balanceOf(holder)).to.be.bignumber.equal(
                '50000000000000000001'
            );
            expect(await this.vault.balanceOfNominal(holder)).to.be.bignumber.equal(
                '33333333333333333334'
            );
            expect(await this.token.balanceOf(this.vault.address)).to.be.bignumber.equal(
                '33333333333333333334'
            );

            await this.vault.withdrawAll(recipient, holder, {
                from: holder,
            });

            expect(await this.token.balanceOf(other)).to.be.bignumber.equal('999999999999999999');
            expect(await this.token.balanceOf(recipient)).to.be.bignumber.equal(
                '99000000000000000001'
            );
            expect(await this.vault.balanceOf(holder)).to.be.bignumber.equal('0');
            expect(await this.vault.balanceOfNominal(holder)).to.be.bignumber.equal('0');
            expect(await this.token.balanceOf(this.vault.address)).to.be.bignumber.equal('0');
        });

        it('should not withdraw by rebalancer', async function () {
            await this.vault.changeWithdrawFee(10000); //1%
            await this.vault.changeFeeDistributor(other);
            const REBALANCER_ROLE = (await this.vault.REBALANCER_ROLE()).toString();
            await this.vault.grantRole(REBALANCER_ROLE, holder);

            expect(await this.vault.previewWithdraw(initialNominal)).to.be.bignumber.equal(
                '66666666666666666666'
            );

            expect(await this.token.balanceOf(other)).to.be.bignumber.equal('0');

            await this.vault.withdraw('1500000000000000000', recipient, holder, {
                from: holder,
            });

            expect(await this.token.balanceOf(other)).to.be.bignumber.equal('0');
        });
    });

    describe('limits', async function () {
        it('deposit', async function () {
            expect(await this.vault.maxDeposit(holder)).to.be.bignumber.equal(
                constants.MAX_UINT256
            );

            expect(await this.vault.dailyDepositDuration()).to.be.bignumber.equal('0');
            expect(await this.vault.dailyDepositLimit()).to.be.bignumber.equal('0');
            expect(await this.vault.dailyDepositTotal()).to.be.bignumber.equal('0');
            expect(await this.vault.dailyDepositCountingBlock()).to.be.bignumber.equal('0');
            await this.vault.changeDailyDepositParams(10, initialValue);
            expect(await this.vault.dailyDepositTotal()).to.be.bignumber.equal('0');
            expect(await this.vault.dailyDepositCountingBlock()).to.be.bignumber.equal(
                await time.latestBlock()
            );
            expect(await this.vault.dailyDepositDuration()).to.be.bignumber.equal('10');
            expect(await this.vault.dailyDepositLimit()).to.be.bignumber.equal(initialValue);

            await this.vault.deposit(initialNominal, recipient, { from: holder });
            expect(await this.vault.dailyDepositTotal()).to.be.bignumber.equal(initialValue);

            await expectRevert(
                this.vault.deposit(parseShare(99), recipient, { from: holder }),
                'Daily deposit limit overflow'
            );

            for (let i = 0; i < 100; i++) await time.advanceBlock();

            await this.token.mint(holder, web3.utils.toWei('100'));
            await this.vault.deposit(parseShare(50), recipient, { from: holder });

            expect(await this.vault.dailyDepositCountingBlock()).to.be.bignumber.equal(
                await time.latestBlock()
            );
            expect(await this.vault.dailyDepositTotal()).to.be.bignumber.equal(parseShare(75));

            await this.vault.changeDailyDepositParams(0, 0);

            await this.token.mint(holder, web3.utils.toWei('1000'));
            await this.vault.deposit(parseShare(1000), recipient, { from: holder });
            expect(await this.vault.dailyDepositCountingBlock()).to.be.bignumber.equal('0');
            expect(await this.vault.dailyDepositTotal()).to.be.bignumber.equal('0');
        });

        it('withdraw', async function () {
            await this.token.mint(holder, web3.utils.toWei('10000'));
            await this.vault.deposit(parseShare(10000), holder, { from: holder });

            expect(await this.vault.maxWithdraw(holder)).to.be.bignumber.equal(parseShare(15150));

            expect(await this.vault.dailyWithdrawDuration()).to.be.bignumber.equal('0');
            expect(await this.vault.dailyWithdrawLimit()).to.be.bignumber.equal('0');
            expect(await this.vault.dailyWithdrawTotal()).to.be.bignumber.equal('0');
            expect(await this.vault.dailyWithdrawCountingBlock()).to.be.bignumber.equal('0');
            await this.vault.changeDailyWithdrawParams(10, initialValue);
            expect(await this.vault.dailyWithdrawTotal()).to.be.bignumber.equal('0');
            expect(await this.vault.dailyWithdrawCountingBlock()).to.be.bignumber.equal(
                await time.latestBlock()
            );
            expect(await this.vault.dailyWithdrawDuration()).to.be.bignumber.equal('10');
            expect(await this.vault.dailyWithdrawLimit()).to.be.bignumber.equal(initialValue);

            await this.vault.withdraw(initialNominal, recipient, holder, { from: holder });
            expect(await this.vault.dailyWithdrawTotal()).to.be.bignumber.equal(initialNominal);

            await expectRevert(
                this.vault.withdraw(parseShare(99), recipient, holder, { from: holder }),
                'Daily withdraw limit overflow'
            );

            for (let i = 0; i < 100; i++) await time.advanceBlock();

            await this.vault.withdraw(parseShare(50), recipient, holder, { from: holder });

            expect(await this.vault.dailyWithdrawCountingBlock()).to.be.bignumber.equal(
                await time.latestBlock()
            );
            expect(await this.vault.dailyWithdrawTotal()).to.be.bignumber.equal(parseShare(50));

            await this.vault.changeDailyWithdrawParams(0, 0);

            await this.vault.withdraw(parseShare(1000), recipient, holder, { from: holder });
            expect(await this.vault.dailyWithdrawCountingBlock()).to.be.bignumber.equal('0');
            expect(await this.vault.dailyWithdrawTotal()).to.be.bignumber.equal('0');
        });
    });

    describe('rigid addresses', async function () {
        it('should not contain zero address', async function () {
            expect(await this.vault.containRigidAddress(ZERO_ADDRESS)).to.be.false;
        });
        it('should be added', async function () {
            expect(await this.vault.balanceOf(holder)).to.be.bignumber.equal(initialValue);
            expect(await this.vault.balanceOfNominal(holder)).to.be.bignumber.equal(initialNominal);
            expect(await this.vault.totalSupplyRigid()).to.be.bignumber.equal(zero);
            expect(await this.vault.lockedNominalRigid()).to.be.bignumber.equal(zero);

            expect(await this.vault.containRigidAddress(holder)).to.be.false;
            await this.vault.addRigidAddress(holder);
            expect(await this.vault.containRigidAddress(holder)).to.be.true;

            expect(await this.vault.balanceOf(holder)).to.be.bignumber.equal(initialValue);
            expect(await this.vault.balanceOfNominal(holder)).to.be.bignumber.equal(zero);
            expect(await this.vault.totalSupplyRigid()).to.be.bignumber.equal(initialValue);
            expect(await this.vault.lockedNominalRigid()).to.be.bignumber.equal(initialNominal);

            await expectRevert(this.vault.addRigidAddress(holder), 'Not elastic address');
        });
        it('should be removed', async function () {
            expect(await this.vault.containRigidAddress(holder)).to.be.false;

            await expectRevert(this.vault.removeRigidAddress(holder), 'Not rigid address');

            await this.vault.addRigidAddress(holder);
            expect(await this.vault.containRigidAddress(holder)).to.be.true;

            expect(await this.vault.balanceOf(holder)).to.be.bignumber.equal(initialValue);
            expect(await this.vault.balanceOfNominal(holder)).to.be.bignumber.equal(zero);
            expect(await this.vault.totalSupplyRigid()).to.be.bignumber.equal(initialValue);
            expect(await this.vault.lockedNominalRigid()).to.be.bignumber.equal(initialNominal);
            await this.vault.removeRigidAddress(holder);
            expect(await this.vault.containRigidAddress(holder)).to.be.false;
            expect(await this.vault.balanceOf(holder)).to.be.bignumber.equal(initialValue);
            expect(await this.vault.balanceOfNominal(holder)).to.be.bignumber.equal(initialNominal);
            expect(await this.vault.totalSupplyRigid()).to.be.bignumber.equal(zero);
            expect(await this.vault.lockedNominalRigid()).to.be.bignumber.equal(zero);
        });
    });

    describe('redistributor', async function () {
        it('should redistribute', async function () {
            const redistributor = await mockContract('IRedistributor');
            await this.vault.setRedistributor(redistributor.address);

            // convert holder to rigid mode
            await this.vault.addRigidAddress(holder);

            // set redistribute
            let newPrice = new BN('2000000000000000000'); // 2 * 10^18
            await this.assetPricer.setAssetPriceInternal(newPrice);
            await this.vault.cacheAssetPrice();

            const nominalRedistributionByTwo = initialNominal.sub(
                initialValue.div(newPrice).mul(one)
            );
            await redistributor.mock.requestRedistribution
                .withArgs(nominalRedistributionByTwo.toString())
                .returns();

            expect(
                await this.vault.lockedNominalRigid()
            ).to.be.bignumber.equal(initialNominal);

            await this.vault.redistribute();

            expect(
                await this.vault.lockedNominalRigid()
            ).to.be.bignumber.equal(initialNominal.sub(nominalRedistributionByTwo));

            expect(
                await this.token.allowance(this.vault.address, redistributor.address)
            ).to.be.bignumber.equal(nominalRedistributionByTwo);

            newPrice = new BN('3000000000000000000'); // 3 * 10^18
            await this.assetPricer.setAssetPriceInternal(newPrice);
            await this.vault.cacheAssetPrice();
            const nominalRedistributionByThree = initialNominal.sub(nominalRedistributionByTwo).sub(
                initialValue.div(newPrice).mul(one)
            );
            await redistributor.mock.requestRedistribution
                .withArgs(nominalRedistributionByThree.toString())
                .returns();

            await this.vault.redistribute();

            expect(
                await this.vault.lockedNominalRigid()
            ).to.be.bignumber.equal(initialNominal.sub(nominalRedistributionByTwo.add(nominalRedistributionByThree)));

            expect(
                await this.token.allowance(this.vault.address, redistributor.address)
            ).to.be.bignumber.equal(nominalRedistributionByTwo.add(nominalRedistributionByThree));
        });
    });
});
