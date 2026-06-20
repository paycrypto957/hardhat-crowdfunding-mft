// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// 测试替身：模拟真实 USDC（6 decimals），任何人可 mint。仅用于本地测试，
// 因为本地 hardhat 节点访问不到 Sepolia 上的真实 USDC 合约。
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6; // 真实 USDC 是 6 位小数
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
