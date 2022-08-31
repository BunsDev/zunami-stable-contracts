// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import "./ElasticERC20.sol";
import "./interfaces/IElasticVault.sol";
import "./interfaces/IElasticVaultMigrator.sol";

/**
 * @dev OpenZeppelin v4.7.0 ERC4626 fork
*/
abstract contract ElasticVault is ElasticERC20, IElasticVault {
    using Math for uint256;

    IERC20Metadata private _asset;

    uint256 public constant FEE_DENOMINATOR = 1000000; // 100.0000%

    uint256 public feePercent;
    address public feeDistributor;

    uint256 public dailyDepositDuration; // in blocks
    uint256 public dailyDepositLimit; // in minimal assets

    uint256 public dailyWithdrawDuration; // in blocks
    uint256 public dailyWithdrawLimit; // in minimal assets

    uint256 public dailyDepositTotal;
    uint256 public dailyDepositCountingBlock; // start block of limit counting

    uint256 public dailyWithdrawTotal;
    uint256 public dailyWithdrawCountingBlock; // start block of limit counting

    /**
     * @dev Set the underlying asset contract. This must be an ERC20-compatible contract (ERC20 or ERC777).
     */
    constructor(IERC20Metadata asset_) {
        _asset = asset_;
    }

    function changeDailyDepositParams(uint256 dailyDepositDuration_, uint256 dailyDepositLimit_) public onlyOwner {
        dailyDepositDuration = dailyDepositDuration_;
        dailyDepositLimit = dailyDepositLimit_;

        dailyDepositTotal = 0;
        dailyDepositCountingBlock = dailyDepositDuration > 0 ? block.number : 0;
    }

    function changeDailyWithdrawParams(uint256 dailyWithdrawDuration_, uint256 dailyWithdrawLimit_) public onlyOwner {
        dailyWithdrawDuration = dailyWithdrawDuration_;
        dailyWithdrawLimit = dailyWithdrawLimit_;

        dailyWithdrawTotal = 0;
        dailyWithdrawCountingBlock = dailyWithdrawDuration > 0 ? block.number : 0;
    }

    function changeWithdrawFee(uint256 withdrawFee_) public onlyOwner {
        require(withdrawFee_ <= FEE_DENOMINATOR, "Bigger that 100%");
        feePercent = withdrawFee_;
    }

    function changeFeeDistributor(address feeDistributor_) public onlyOwner {
        require(feeDistributor_ != address(0), "Zero fee distributor");
        feeDistributor = feeDistributor_;
    }

    function migrateToOtherAsset(address asset_, address priceOracle_, address migrator_) public onlyOwner {
        // reset daily limits
        dailyDepositTotal = 0;
        dailyDepositCountingBlock = 0;
        dailyWithdrawTotal = 0;
        dailyWithdrawCountingBlock = 0;

        // migrate old asset balance to new one
        uint256 currentAssetVaultBalance = IERC20Metadata(asset()).balanceOf(address(this));
        SafeERC20.safeIncreaseAllowance(
            IERC20Metadata(asset()),
            migrator_,
            currentAssetVaultBalance
        );
        IElasticVaultMigrator(migrator_).migrate(
            asset(),
            asset_,
            currentAssetVaultBalance
        );
        require(IERC20Metadata(asset_).balanceOf(address(this)) > 0, "Zero new asset balance after migration");

        // change asset and it's price oracle
        _asset = IERC20Metadata(asset_);
        changePriceOracle(priceOracle_);
    }

    /** @dev See {IERC4262-asset}. */
    function asset() public view virtual override returns (address) {
        return address(_asset);
    }

    /** @dev See {IERC4262-totalAssets}. */
    function totalAssets() public view virtual override returns (uint256) {
        return _asset.balanceOf(address(this));
    }

    /** @dev See {IERC4262-convertToShares}. */
    function convertToShares(uint256 assets) public view virtual override returns (uint256 shares) {
        return _convertToNominal(assets, Math.Rounding.Down);
    }

    /** @dev See {IERC4262-convertToAssets}. */
    function convertToAssets(uint256 shares) public view virtual override returns (uint256 assets) {
        return _convertFromNominal(shares, Math.Rounding.Down);
    }

    /** @dev See {IERC4262-maxDeposit}. */
    function maxDeposit(address) public view virtual override returns (uint256) {
        return _isVaultCollateralized() ? type(uint256).max : 0;
    }

    /** @dev See {IERC4262-maxWithdraw}. */
    function maxWithdraw(address owner) public view virtual override returns (uint256) {
        return _convertFromNominal(balanceOf(owner), Math.Rounding.Down);
    }

    /** @dev See {IERC4262-previewDeposit}. */
    function previewDeposit(uint256 assets) public view virtual override returns (uint256) {
        return _convertToNominal(assets, Math.Rounding.Down);
    }

    function _previewDepositCached(uint256 assets) internal virtual returns (uint256) {
        return _convertToNominalCached(assets, Math.Rounding.Down);
    }

    /** @dev See {IERC4262-previewWithdraw}. */
    function previewWithdraw(uint256 assets) public view virtual override returns (uint256) {
        return _convertToNominal(assets, Math.Rounding.Up);
    }

    function _previewWithdrawCached(uint256 assets) internal virtual returns (uint256) {
        return _convertToNominalCached(assets, Math.Rounding.Up);
    }

    /** @dev See {IERC4262-deposit}. */
    function deposit(uint256 assets, address receiver) public virtual override returns (uint256) {
        require(assets <= maxDeposit(receiver), "ERC4626: deposit more than max");

        uint256 shares = _previewDepositCached(assets);
        _deposit(_msgSender(), receiver, assets, shares);

        return shares;
    }

    /** @dev See {IERC4262-withdraw}. */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public virtual override returns (uint256) {
        require(assets <= maxWithdraw(owner), "ERC4626: withdraw more than max");

        uint256 shares = _previewWithdrawCached(assets);
        _withdraw(_msgSender(), receiver, owner, assets, shares);

        return shares;
    }

    /**
     * @dev Deposit/mint common workflow.
     */
    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal virtual {
        if(dailyDepositDuration > 0) {
            if(block.number > dailyDepositCountingBlock + dailyDepositDuration) {
                dailyDepositTotal = 0;
                dailyDepositCountingBlock = dailyDepositCountingBlock + dailyDepositDuration;
            }
            dailyDepositTotal += assets;
            require(dailyDepositTotal <= dailyDepositLimit, "Daily deposit limit overflow");
        }

        // If _asset is ERC777, `transferFrom` can trigger a reenterancy BEFORE the transfer happens through the
        // `tokensToSend` hook. On the other hand, the `tokenReceived` hook, that is triggered after the transfer,
        // calls the vault, which is assumed not malicious.
        //
        // Conclusion: we need to do the transfer before we mint so that any reentrancy would happen before the
        // assets are transfered and before the shares are minted, which is a valid state.
        // slither-disable-next-line reentrancy-no-eth
        SafeERC20.safeTransferFrom(IERC20Metadata(asset()), caller, address(this), assets);
        _mint(receiver, shares, assets);

        emit Deposit(caller, receiver, assets, shares);
    }

    /**
     * @dev Withdraw/redeem common workflow.
     */
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal virtual {

        uint256 feeAmount;
        if(feePercent > 0) {
            feeAmount = shares.mulDiv(feePercent, FEE_DENOMINATOR, Math.Rounding.Down);
            shares -= feeAmount;

            feeAmount = assets.mulDiv(feePercent, FEE_DENOMINATOR, Math.Rounding.Down);
            assets -= feeAmount;
        }

        if(dailyWithdrawDuration > 0) {
            if(block.number > dailyWithdrawCountingBlock + dailyWithdrawDuration) {
                dailyWithdrawTotal = 0;
                dailyWithdrawCountingBlock = dailyWithdrawCountingBlock + dailyWithdrawDuration;
            }
            dailyWithdrawTotal += assets;
            require(dailyWithdrawTotal <= dailyWithdrawLimit, "Daily withdraw limit overflow");
        }

        if (caller != owner) {
            _spendAllowance(owner, caller, shares);
        }

        // If _asset is ERC777, `transfer` can trigger a reentrancy AFTER the transfer happens through the
        // `tokensReceived` hook. On the other hand, the `tokensToSend` hook, that is triggered before the transfer,
        // calls the vault, which is assumed not malicious.
        //
        // Conclusion: we need to do the transfer after the burn so that any reentrancy would happen after the
        // shares are burned and after the assets are transfered, which is a valid state.
        _burn(owner, shares, assets);
        SafeERC20.safeTransfer(IERC20Metadata(asset()), receiver, assets);
        if(feeAmount > 0) {
            SafeERC20.safeTransfer(IERC20Metadata(asset()), feeDistributor, feeAmount);
        }

        emit Withdraw(caller, receiver, owner, assets, shares, feeAmount);
    }

    function _isVaultCollateralized() private view returns (bool) {
        return totalAssets() > 0 || totalSupply() == 0;
    }
}
