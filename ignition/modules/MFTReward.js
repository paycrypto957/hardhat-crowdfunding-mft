// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const ONE_ETH = 1_000_000_000_000_000_000n;
const SEVEN_DAYS = 7n * 24n * 60n * 60n;

module.exports = buildModule("MFTRewardModule", (m) => {
  const goal = m.getParameter("goal", ONE_ETH);
  const durationInSeconds = m.getParameter("durationInSeconds", SEVEN_DAYS);

  // 先部署 Crowdfunding；把它的地址作为 MFTReward 的构造参数。
  // Ignition 会自动处理依赖，保证 Crowdfunding 在 MFTReward 之前部署。
  const crowdfunding = m.contract("Crowdfunding", [goal, durationInSeconds]);
  const mftReward = m.contract("MFTReward", [crowdfunding]);

  return { crowdfunding, mftReward };
});
