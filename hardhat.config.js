// 从 .env 读取密钥（ETHERSCAN_API_KEY / RPC / 私钥）。.env 已在 .gitignore 中。
require("dotenv").config();

require("@nomicfoundation/hardhat-toolbox");

// 自定义 task：部署与验证
require("./tasks/deploy");
require("./tasks/verify");
require("./tasks/deploy-usdc");
require("./tasks/verify-usdc");

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    // Etherscan 源码验证需要合约先部署到真实网络。下面以 Sepolia 测试网为例。
    // 本地节点仍可用 `--network localhost`（hardhat 内置，无需在此声明）。
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
};
