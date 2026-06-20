// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const ONE_ETH = 1_000_000_000_000_000_000n;
const SEVEN_DAYS = 7n * 24n * 60n * 60n;

module.exports = buildModule("CrowdfundingModule", (m) => {
  const goal = m.getParameter("goal", ONE_ETH);
  const durationInSeconds = m.getParameter("durationInSeconds", SEVEN_DAYS);

  // 不像 Lock.js 那样传 { value } —— 众筹资金通过 fund() 收取，部署时无需预付
  const crowdfunding = m.contract("Crowdfunding", [goal, durationInSeconds]);

  return { crowdfunding };
});
