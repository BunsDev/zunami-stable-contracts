// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../interfaces/IZunami.sol';
import '../interfaces/IZunamiStrategy.sol';

contract ZunamiMock is ERC20, IZunami {
    PoolInfo[] internal _poolInfo;

    address[3] public tokens;

    constructor(address[3] memory _tokens) ERC20('Zunami Test', 'ZLPT') {
        tokens = _tokens;
    }

    function addPool(address _strategyAddr) external {
        _poolInfo.push(
            PoolInfo({
                strategy: IZunamiStrategy(_strategyAddr),
                startTime: block.timestamp,
                lpShares: 0
            })
        );
    }

    function setLpShares(uint256 pid, uint256 lpShares) external {
        _poolInfo[pid].lpShares = lpShares;
    }

    function delegateWithdrawal(uint256 lpShares, uint256[3] memory tokenAmounts) external {
        SafeERC20.safeTransferFrom(IERC20(address(this)), msg.sender, address(this), lpShares);
    }

    function poolInfo(uint256 pid) external view returns (PoolInfo memory) {
        return _poolInfo[pid];
    }

    function poolCount() external view returns (uint256) {
        return _poolInfo.length;
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public {
        _burn(account, amount);
    }
}
