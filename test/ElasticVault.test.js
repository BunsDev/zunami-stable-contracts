const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const ERC20DecimalsMock = artifacts.require('ERC20DecimalsMock');
const ElasticVaultMock = artifacts.require('ElasticVaultMock');
const AssetPriceOracleMock = artifacts.require('AssetPriceOracleMock');

const parseToken = (token) => (new BN(token)).mul(new BN('1000000000000000000'));
const parseShare = (share) => (new BN(share)).mul(new BN('1000000000000000000'));

contract('ElasticVault', function (accounts) {
  const [ holder, recipient, spender, other, user1, user2 ] = accounts;

  const name = 'My Token';
  const symbol = 'MTKN';

  beforeEach(async function () {
    this.assetPricer = await AssetPriceOracleMock.new();
    this.token = await ERC20DecimalsMock.new(name, symbol, 18);
    this.vault = await ElasticVaultMock.new(this.token.address, this.assetPricer.address, name + ' Vault', symbol + 'V');

    await this.token.mint(holder, web3.utils.toWei('100'));
    await this.token.approve(this.vault.address, constants.MAX_UINT256, { from: holder });
    await this.vault.approve(spender, constants.MAX_UINT256, { from: holder });
  });

  it('metadata', async function () {
    expect(await this.vault.name()).to.be.equal(name + ' Vault');
    expect(await this.vault.symbol()).to.be.equal(symbol + 'V');
    expect(await this.vault.decimals()).to.be.bignumber.equal('18');
    expect(await this.vault.asset()).to.be.equal(this.token.address);
  });

  describe('empty vault: no assets & no shares', function () {
    it('status', async function () {
      expect(await this.vault.totalAssets()).to.be.bignumber.equal('0');
    });

    it('deposit', async function () {
      expect(await this.vault.maxDeposit(holder)).to.be.bignumber.equal(constants.MAX_UINT256);
      expect(await this.vault.previewDeposit(parseToken(1))).to.be.bignumber.equal(parseShare(1));

      const { tx } = await this.vault.deposit(parseToken(1), recipient, { from: holder });

      expectEvent.inTransaction(tx, this.token, 'Transfer', {
        from: holder,
        to: this.vault.address,
        value: parseToken(1),
      });

      expectEvent.inTransaction(tx, this.vault, 'Transfer', {
        from: constants.ZERO_ADDRESS,
        to: recipient,
        value: parseShare(1),
      });
    });

    it('withdraw', async function () {
      expect(await this.vault.maxWithdraw(holder)).to.be.bignumber.equal('0');
      expect(await this.vault.previewWithdraw('0')).to.be.bignumber.equal('0');

      const { tx } = await this.vault.withdraw('0', recipient, holder, { from: holder });

      expectEvent.inTransaction(tx, this.token, 'Transfer', {
        from: this.vault.address,
        to: recipient,
        value: '0',
      });

      expectEvent.inTransaction(tx, this.vault, 'Transfer', {
        from: holder,
        to: constants.ZERO_ADDRESS,
        value: '0',
      });
    });
  });

  describe('partially empty vault: assets & no shares', function () {
    beforeEach(async function () {
      await this.token.mint(this.vault.address, parseToken(1)); // 1 token
    });

    it('status', async function () {
      expect(await this.vault.totalAssets()).to.be.bignumber.equal(parseToken(1));
    });

    it('deposit', async function () {
      expect(await this.vault.maxDeposit(holder)).to.be.bignumber.equal(constants.MAX_UINT256);
      expect(await this.vault.previewDeposit(parseToken(1))).to.be.bignumber.equal(parseShare(1));

      const { tx } = await this.vault.deposit(parseToken(1), recipient, { from: holder });

      expectEvent.inTransaction(tx, this.token, 'Transfer', {
        from: holder,
        to: this.vault.address,
        value: parseToken(1),
      });

      expectEvent.inTransaction(tx, this.vault, 'Transfer', {
        from: constants.ZERO_ADDRESS,
        to: recipient,
        value: parseShare(1),
      });
    });

    it('withdraw', async function () {
      expect(await this.vault.maxWithdraw(holder)).to.be.bignumber.equal('0');
      expect(await this.vault.previewWithdraw('0')).to.be.bignumber.equal('0');

      const { tx } = await this.vault.withdraw('0', recipient, holder, { from: holder });

      expectEvent.inTransaction(tx, this.token, 'Transfer', {
        from: this.vault.address,
        to: recipient,
        value: '0',
      });

      expectEvent.inTransaction(tx, this.vault, 'Transfer', {
        from: holder,
        to: constants.ZERO_ADDRESS,
        value: '0',
      });
    });
  });

  describe('partially empty vault: shares & no assets', function () {
    beforeEach(async function () {
      await this.vault.mockMint(holder, parseToken(1), parseShare(1)); // 1 share
    });

    it('status', async function () {
      expect(await this.vault.totalAssets()).to.be.bignumber.equal('0');
    });

    it('deposit', async function () {
      expect(await this.vault.maxDeposit(holder)).to.be.bignumber.equal('0');

      // Can deposit 0 (max deposit)
      const { tx } = await this.vault.deposit(0, recipient, { from: holder });

      expectEvent.inTransaction(tx, this.token, 'Transfer', {
        from: holder,
        to: this.vault.address,
        value: 0,
      });

      expectEvent.inTransaction(tx, this.vault, 'Transfer', {
        from: constants.ZERO_ADDRESS,
        to: recipient,
        value: 0,
      });

      // Cannot deposit more than 0
      //TODO //await expectRevert.unspecified(this.vault.previewDeposit(parseToken(1)));
      await expectRevert(
        this.vault.deposit(parseToken(1), recipient, { from: holder }),
        'ERC4626: deposit more than max',
      );
    });

    it('withdraw', async function () {
      expect(await this.vault.maxWithdraw(holder)).to.be.bignumber.equal(parseToken(1));
      expect(await this.vault.previewWithdraw('0')).to.be.bignumber.equal('0');
      //TODO //await expectRevert.unspecified(this.vault.previewWithdraw('1'));

      const { tx } = await this.vault.withdraw('0', recipient, holder, { from: holder });

      expectEvent.inTransaction(tx, this.token, 'Transfer', {
        from: this.vault.address,
        to: recipient,
        value: '0',
      });

      expectEvent.inTransaction(tx, this.vault, 'Transfer', {
        from: holder,
        to: constants.ZERO_ADDRESS,
        value: '0',
      });
    });
  });

  describe('full vault: assets & shares', function () {
    beforeEach(async function () {
      await this.token.mint(this.vault.address, parseToken(1)); // 1 tokens
      await this.vault.mockMint(holder, parseShare(100), parseShare(100)); // 100 share
    });

    it('status', async function () {
      expect(await this.vault.totalAssets()).to.be.bignumber.equal(parseToken(1));
    });

    it('deposit', async function () {
      expect(await this.vault.maxDeposit(holder)).to.be.bignumber.equal(constants.MAX_UINT256);
      expect(await this.vault.previewDeposit(parseToken(1))).to.be.bignumber.equal(parseShare(1));

      const { tx } = await this.vault.deposit(parseToken(1), recipient, { from: holder });

      expectEvent.inTransaction(tx, this.token, 'Transfer', {
        from: holder,
        to: this.vault.address,
        value: parseToken(1),
      });

      expectEvent.inTransaction(tx, this.vault, 'Transfer', {
        from: constants.ZERO_ADDRESS,
        to: recipient,
        value: parseShare(100),
      });
    });

    it('withdraw', async function () {
      expect(await this.vault.maxWithdraw(holder)).to.be.bignumber.equal(parseToken(100));
      expect(await this.vault.previewWithdraw(parseToken(1))).to.be.bignumber.equal(parseShare(1));

      const { tx } = await this.vault.withdraw(parseToken(1), recipient, holder, { from: holder });

      expectEvent.inTransaction(tx, this.token, 'Transfer', {
        from: this.vault.address,
        to: recipient,
        value: parseToken(1),
      });

      expectEvent.inTransaction(tx, this.vault, 'Transfer', {
        from: holder,
        to: constants.ZERO_ADDRESS,
        value: parseShare(100),
      });
    });

    it('withdraw with approval', async function () {
      await expectRevert(
        this.vault.withdraw(parseToken(1), recipient, holder, { from: other }),
        'ERC20: insufficient allowance',
      );

      await this.vault.withdraw(parseToken(1), recipient, holder, { from: spender });
    });

  });

  /// Scenario inspired by solmate ERC4626 tests:
  /// https://github.com/transmissions11/solmate/blob/main/src/test/ERC4626.t.sol
  it('multiple mint, deposit, redeem & withdrawal', async function () {
    // test designed with both asset using similar decimals
    this.assetPricer = await AssetPriceOracleMock.new();
    this.token = await ERC20DecimalsMock.new(name, symbol, 18);
    this.vault = await ElasticVaultMock.new(this.token.address, this.assetPricer.address, name + ' Vault', symbol + 'V');

    await this.token.mint(user1, 4000);
    await this.token.mint(user2, 7001);
    await this.token.approve(this.vault.address, 4000, { from: user1 });
    await this.token.approve(this.vault.address, 7001, { from: user2 });

    // 1. Alice mints 2000 shares (costs 2000 tokens)
    {
      const { tx } = await this.vault.deposit(2000, user1, { from: user1 });
      expectEvent.inTransaction(tx, this.token, 'Transfer', {
        from: user1,
        to: this.vault.address,
        value: '2000',
      });
      expectEvent.inTransaction(tx, this.vault, 'Transfer', {
        from: constants.ZERO_ADDRESS,
        to: user1,
        value: '2000',
      });

      expect(await this.vault.previewDeposit(2000)).to.be.bignumber.equal('2000');
      expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('2000');
      expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('0');
      expect(await this.vault.convertToAssets(await this.vault.balanceOf(user1))).to.be.bignumber.equal('2000');
      expect(await this.vault.convertToAssets(await this.vault.balanceOf(user2))).to.be.bignumber.equal('0');
      expect(await this.vault.totalSupply()).to.be.bignumber.equal('2000');
      expect(await this.vault.totalAssets()).to.be.bignumber.equal('2000');
    }

    // 2. Bob deposits 4000 tokens (mints 4000 shares)
    {
      const { tx } = await this.vault.deposit(4000, user2, { from: user2 });
      expectEvent.inTransaction(tx, this.token, 'Transfer', {
        from: user2,
        to: this.vault.address,
        value: '4000',
      });
      expectEvent.inTransaction(tx, this.vault, 'Transfer', {
        from: constants.ZERO_ADDRESS,
        to: user2,
        value: '4000',
      });

      expect(await this.vault.previewDeposit(4000)).to.be.bignumber.equal('4000');
      expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('2000');
      expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('4000');
      expect(await this.vault.convertToAssets(await this.vault.balanceOf(user1))).to.be.bignumber.equal('2000');
      expect(await this.vault.convertToAssets(await this.vault.balanceOf(user2))).to.be.bignumber.equal('4000');
      expect(await this.vault.totalSupply()).to.be.bignumber.equal('6000');
      expect(await this.vault.totalAssets()).to.be.bignumber.equal('6000');
    }

    // 3. Vault mutates by +3000 tokens (simulated yield returned from strategy)
    await this.token.mint(this.vault.address, 3000);

    expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('2000');
    expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('4000');
    expect(await this.vault.convertToAssets(await this.vault.balanceOf(user1))).to.be.bignumber.equal('2000');
    expect(await this.vault.convertToAssets(await this.vault.balanceOf(user2))).to.be.bignumber.equal('4000');
    expect(await this.vault.totalSupply()).to.be.bignumber.equal('6000');
    expect(await this.vault.totalAssets()).to.be.bignumber.equal('9000');

    // 4. Alice deposits 2000 tokens (mints 1333 shares)
    {
      const { tx } = await this.vault.deposit(2000, user1, { from: user1 });
      expectEvent.inTransaction(tx, this.token, 'Transfer', {
        from: user1,
        to: this.vault.address,
        value: '2000',
      });
      expectEvent.inTransaction(tx, this.vault, 'Transfer', {
        from: constants.ZERO_ADDRESS,
        to: user1,
        value: '1333',
      });

      expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('4000');
      expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('4000');
      expect(await this.vault.convertToAssets(await this.vault.balanceOf(user1))).to.be.bignumber.equal('4000');
      expect(await this.vault.convertToAssets(await this.vault.balanceOf(user2))).to.be.bignumber.equal('4000');
      expect(await this.vault.totalSupply()).to.be.bignumber.equal('8000');
      expect(await this.vault.totalAssets()).to.be.bignumber.equal('11000');
    }

    // 5. Bob mints 2000 shares (costs 3001 assets)
    // NOTE: Bob's assets spent got rounded up
    // NOTE: Alices's vault assets got rounded up
    {
      const { tx } = await this.vault.deposit(2000, user2, { from: user2 });
      expectEvent.inTransaction(tx, this.token, 'Transfer', {
        from: user2,
        to: this.vault.address,
        value: '3001',
      });
      expectEvent.inTransaction(tx, this.vault, 'Transfer', {
        from: constants.ZERO_ADDRESS,
        to: user2,
        value: '2000',
      });

      expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('4000');
      expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('6000');
      expect(await this.vault.convertToAssets(await this.vault.balanceOf(user1))).to.be.bignumber.equal('4000');
      expect(await this.vault.convertToAssets(await this.vault.balanceOf(user2))).to.be.bignumber.equal('6000');
      expect(await this.vault.totalSupply()).to.be.bignumber.equal('10000');
      expect(await this.vault.totalAssets()).to.be.bignumber.equal('13000');
    }

    // 6. Vault mutates by +3000 tokens
    // NOTE: Vault holds 17001 tokens, but sum of assetsOf() is 17000.
    await this.token.mint(this.vault.address, 3000);

    expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('4000');
    expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('6000');
    expect(await this.vault.convertToAssets(await this.vault.balanceOf(user1))).to.be.bignumber.equal('4000');
    expect(await this.vault.convertToAssets(await this.vault.balanceOf(user2))).to.be.bignumber.equal('6000');
    expect(await this.vault.totalSupply()).to.be.bignumber.equal('10000');
    expect(await this.vault.totalAssets()).to.be.bignumber.equal('16000');

    // 7. Alice redeem 1333 shares (2428 assets)
    {
      const { tx } = await this.vault.withdraw(1333, user1, user1, { from: user1 });
      expectEvent.inTransaction(tx, this.vault, 'Transfer', {
        from: user1,
        to: constants.ZERO_ADDRESS,
        value: '1333',
      });
      expectEvent.inTransaction(tx, this.token, 'Transfer', {
        from: this.vault.address,
        to: user1,
        value: '2428',
      });

      expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('2667');
      expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('6000');
      expect(await this.vault.convertToAssets(await this.vault.balanceOf(user1))).to.be.bignumber.equal('2667');
      expect(await this.vault.convertToAssets(await this.vault.balanceOf(user2))).to.be.bignumber.equal('6000');
      expect(await this.vault.totalSupply()).to.be.bignumber.equal('8667');
      expect(await this.vault.totalAssets()).to.be.bignumber.equal('14667');
    }

    // 8. Bob withdraws 2929 assets (1608 shares)
    {
      const { tx } = await this.vault.withdraw(2929, user2, user2, { from: user2 });
      expectEvent.inTransaction(tx, this.vault, 'Transfer', {
        from: user2,
        to: constants.ZERO_ADDRESS,
        value: '1608',
      });
      expectEvent.inTransaction(tx, this.token, 'Transfer', {
        from: this.vault.address,
        to: user2,
        value: '2929',
      });

      expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('2667');
      expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('3071');
      expect(await this.vault.convertToAssets(await this.vault.balanceOf(user1))).to.be.bignumber.equal('2667');
      expect(await this.vault.convertToAssets(await this.vault.balanceOf(user2))).to.be.bignumber.equal('3071');
      expect(await this.vault.totalSupply()).to.be.bignumber.equal('5738');
      expect(await this.vault.totalAssets()).to.be.bignumber.equal('11738');
    }

    // 9. Alice withdraws 3643 assets (2000 shares)
    // NOTE: Bob's assets have been rounded back up
    {
      const { tx } = await this.vault.withdraw(2667, user1, user1, { from: user1 });
      expectEvent.inTransaction(tx, this.vault, 'Transfer', {
        from: user1,
        to: constants.ZERO_ADDRESS,
        value: '2000',
      });
      expectEvent.inTransaction(tx, this.token, 'Transfer', {
        from: this.vault.address,
        to: user1,
        value: '3643',
      });

      expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('0');
      expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('3071');
      expect(await this.vault.convertToAssets(await this.vault.balanceOf(user1))).to.be.bignumber.equal('0');
      expect(await this.vault.convertToAssets(await this.vault.balanceOf(user2))).to.be.bignumber.equal('3071');
      expect(await this.vault.totalSupply()).to.be.bignumber.equal('3071');
      expect(await this.vault.totalAssets()).to.be.bignumber.equal('9071');
    }

    // 10. Bob redeem 4392 shares (8001 tokens)
    {
      const { tx } = await this.vault.withdraw(3071, user2, user2, { from: user2 });
      expectEvent.inTransaction(tx, this.vault, 'Transfer', {
        from: user2,
        to: constants.ZERO_ADDRESS,
        value: '4392',
      });
      expectEvent.inTransaction(tx, this.token, 'Transfer', {
        from: this.vault.address,
        to: user2,
        value: '8001',
      });

      expect(await this.vault.balanceOf(user1)).to.be.bignumber.equal('0');
      expect(await this.vault.balanceOf(user2)).to.be.bignumber.equal('0');
      expect(await this.vault.convertToAssets(await this.vault.balanceOf(user1))).to.be.bignumber.equal('0');
      expect(await this.vault.convertToAssets(await this.vault.balanceOf(user2))).to.be.bignumber.equal('0');
      expect(await this.vault.totalSupply()).to.be.bignumber.equal('0');
      expect(await this.vault.totalAssets()).to.be.bignumber.equal('6000'); //TODO: 0
    }
  });
});
