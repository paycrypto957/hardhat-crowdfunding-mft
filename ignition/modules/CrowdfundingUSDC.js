// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const GOAL_USDC = 1000n * 10n ** 6n; // 1000 USDC (6 decimals)
const SEVEN_DAYS = 7n * 24n * 60n * 60n;
// Sepolia 真实 USDC（生产用）：0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238

module.exports = buildModule("CrowdfundingUSDCModule", (m) => {
  const goal = m.getParameter("goal", GOAL_USDC);
  const durationInSeconds = m.getParameter("durationInSeconds", SEVEN_DAYS);

  // 本地 demo：先部署 MockUSDC 作 USDC 替身。
  // 上 Sepolia 时：删掉下面这行，把真实 USDC 地址 0x1c7D... 作为 CrowdfundingUSDC 第一参。
  const usdc = m.contract("MockUSDC");
  const crowdfunding = m.contract("CrowdfundingUSDC", [
    usdc,
    goal,
    durationInSeconds,
  ]);
  const mftReward = m.contract("MFTRewardUSDC", [crowdfunding]);

  return { usdc, crowdfunding, mftReward };
});
