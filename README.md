# Hardhat Crowdfunding + MFT Reward

基于 Hardhat 的智能合约项目：**众筹**（ETH 版 + USDC 版）+ **ERC20 奖励代币 MFT**。用户用 USDC 参与众筹，众筹成功（达标 + 到期）后按捐款额领取 MFT 奖励，比例 **1 USDC = 10 MFT**。

## 合约一览

| 合约 | 说明 |
|---|---|
| `CrowdfundingUSDC` | USDC 众筹：`fund` / `withdraw` / `claimRefund` + `backersCount`（参与人数） |
| `MFTRewardUSDC` | 众筹成功后按捐款额铸造 MFT（继承 OpenZeppelin ERC20，1 USDC = 10 MFT） |
| `Crowdfunding` / `MFTReward` | ETH 版（用原生 ETH 捐款，1 ETH = 1000 MFT） |
| `MockUSDC` | 本地测试用的 6-decimals USDC 替身 |
| `Lock` | Hardhat 脚手架示例 |

## 已部署（Sepolia 测试网）

| 合约 | 地址 |
|---|---|
| CrowdfundingUSDC | `0x2b7850062e308f0d1cd24a7a3c5d533354fafbe6` |
| MFTRewardUSDC | `0x0acea491c4bdffea7327eaf52e86f4577867513e` |
| USDC（Sepolia） | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |

## 部署合约

```bash
npx hardhat deploy-usdc --network sepolia --goal 2000 --duration 2592000
```

参数：
- `--goal`：目标金额（USDC，人类可读，`2000` = 2000 USDC）
- `--duration`：持续秒数（`2592000` = 30 天）
- 部署后地址自动记录到 `.crowdfunding-usdc-deployment.json`

## 验证合约（Etherscan 源码验证）

```bash
npx hardhat verify-crowdfunding-usdc --network sepolia \
  --crowdfunding 0x2b7850062e308f0d1cd24a7a3c5d533354fafbe6 \
  --mft-reward 0x0acea491c4bdffea7327eaf52e86f4577867513e \
  --usdc 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 \
  --goal 2000 --duration 2592000
```

> 首次部署后也可不传参数，task 会自动读 `.crowdfunding-usdc-deployment.json` 里的地址和 constructor args。验证需要 `.env` 里的 `ETHERSCAN_API_KEY`。

## 开发命令

```bash
npx hardhat compile                              # 编译合约
npx hardhat test                                 # 跑全部测试
npx hardhat test test/CrowdfundingUSDC.js        # 跑单个测试文件
npx hardhat node                                 # 起本地节点（chainId 31337）
```

本地一键部署（Ignition，三合约一起）：
```bash
npx hardhat ignition deploy ignition/modules/CrowdfundingUSDC.js --network localhost
```

## 配置（`.env`）

参考 `.env.example`：

- `SEPOLIA_RPC_URL` —— Alchemy / Infura 的 Sepolia endpoint
- `PRIVATE_KEY` —— 测试钱包私钥（⚠️ 只用测试钱包，切勿使用主网钱包）
- `ETHERSCAN_API_KEY` —— Etherscan API key（验证用）

## 项目结构

```
contracts/          # 合约源码（Solidity 0.8.28）
  mocks/            # 测试替身（MockUSDC）
test/               # 测试（Chai + hardhat-toolbox）
ignition/modules/   # Ignition 部署模块
tasks/              # 自定义 task（deploy-usdc / verify-crowdfunding-usdc）
abi/                # 导出的 ABI（供前端使用）
```

## 技术栈

- Solidity `0.8.28` + Hardhat 2.x + `@nomicfoundation/hardhat-toolbox` v6
- OpenZeppelin Contracts 5.x（ERC20）
- ethers v6（测试与 task）
