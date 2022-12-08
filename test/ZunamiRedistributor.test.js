const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const ZunamiMock = artifacts.require('ZunamiMock');
const ZunamiStrategyMock = artifacts.require('ZunamiStrategyMock');
const ZunamiRedistributor = artifacts.require('ZunamiRedistributor');
const ERC20DecimalsMock = artifacts.require('ERC20DecimalsMock');

const one = new BN(10).pow(new BN(18));
const oneSix = new BN(10).pow(new BN(6));

contract('ZunamiRedistributor', function (accounts) {
    const [holder, recipient, spender, other, user1, user2] = accounts;

    beforeEach(async function () {
        this.tokens = await Promise.all([
            await ERC20DecimalsMock.new('DAI', 'DAI', 18),
            await ERC20DecimalsMock.new('USDC', 'USDC', 6),
            await ERC20DecimalsMock.new('USDT', 'USDT', 6),
        ]);
        this.zunami = await ZunamiMock.new(this.tokens.map((t) => t.address));

        this.redistributor = await ZunamiRedistributor.new(this.zunami.address);
    });

    it('should be initiated', async function () {
        expect(await this.redistributor.zunami()).to.be.equal(this.zunami.address);
    });

    it('should redistribute value', async function () {
        const poolTotalShares = one.mul(new BN(100));
        await this.zunami.mint(holder, poolTotalShares);

        const poolCount = 5;
        const poolSharesPercents = [33, 1, 19, 20, 27].map((value) =>
            poolTotalShares.mul(new BN(value)).div(new BN(100))
        );
        const strategis = [];
        for (let pid = 0; pid < poolCount; pid++) {
            const strategy = await ZunamiStrategyMock.new(this.tokens.map((t) => t.address));
            strategis.push(strategy);
            await this.zunami.addPool(strategy.address);
            await this.zunami.setLpShares(pid, poolSharesPercents[pid]);
        }

        await this.zunami.approve(this.redistributor.address, poolTotalShares);

        await this.redistributor.requestRedistribution(poolTotalShares);
        expect(await this.zunami.balanceOf(this.zunami.address)).to.be.bignumber.equal(
            poolTotalShares
        );

        const tokenValue = one.mul(new BN(100));
        const tokenValueSix = oneSix.mul(new BN(100));
        await this.tokens[0].mint(this.redistributor.address, tokenValue);
        await this.tokens[1].mint(this.redistributor.address, tokenValueSix);
        await this.tokens[2].mint(this.redistributor.address, tokenValueSix);

        for (let pid = 0; pid < poolCount; pid++) {
            expect(await this.tokens[0].balanceOf(strategis[pid].address)).to.be.bignumber.equal(
                new BN(0)
            );
            expect(await this.tokens[1].balanceOf(strategis[pid].address)).to.be.bignumber.equal(
                new BN(0)
            );
            expect(await this.tokens[2].balanceOf(strategis[pid].address)).to.be.bignumber.equal(
                new BN(0)
            );
        }

        await this.redistributor.redistribute();

        for (let pid = 0; pid < poolCount; pid++) {
            expect(await this.tokens[0].balanceOf(strategis[pid].address)).to.be.bignumber.equal(
                tokenValue.mul(poolSharesPercents[pid]).div(poolTotalShares)
            );
            expect(await this.tokens[1].balanceOf(strategis[pid].address)).to.be.bignumber.equal(
                tokenValueSix.mul(poolSharesPercents[pid]).div(poolTotalShares)
            );
            expect(await this.tokens[2].balanceOf(strategis[pid].address)).to.be.bignumber.equal(
                tokenValueSix.mul(poolSharesPercents[pid]).div(poolTotalShares)
            );
        }
    });
});
