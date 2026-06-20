// 自定义 Hardhat task：把 USDC 版的 CrowdfundingUSDC + MFTRewardUSDC 在 Etherscan 上验证。
// 读 deploy-usdc 记录的地址和 constructor args，自动填入 verify:verify。
// 用法：npx hardhat verify-crowdfunding-usdc --network sepolia
//      npx hardhat verify-crowdfunding-usdc --network sepolia --crowdfunding 0x... --mft-reward 0x... \
//                                           --usdc 0x... --goal 1000 --duration 604800

const { task } = require("hardhat/config");
const fs = require("fs");
const path = require("path");

const DEPLOYMENT_FILE = path.join(
  __dirname,
  "..",
  ".crowdfunding-usdc-deployment.json"
);

function loadDeployment(network) {
  if (!fs.existsSync(DEPLOYMENT_FILE)) {
    throw new Error(
      `No deployment record at ${DEPLOYMENT_FILE}. Run "npx hardhat deploy-usdc" first.`
    );
  }
  const records = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf8"));
  const record = records[network];
  if (!record) {
    throw new Error(
      `No deployment recorded for network "${network}". Available: ${Object.keys(
        records
      ).join(", ")}.`
    );
  }
  return record;
}

async function verifyOne(hre, label, address, constructorArguments) {
  console.log(
    `Verifying ${label} (${address}) with constructor args [${constructorArguments.join(
      ", "
    )}]...`
  );
  try {
    await hre.run("verify:verify", { address, constructorArguments });
  } catch (err) {
    if (/already verified/i.test(err.message)) {
      console.log(`${label} is already verified, nothing to do.`);
      return;
    }
    throw err;
  }
}

task(
  "verify-crowdfunding-usdc",
  "Verify the USDC Crowdfunding + MFTReward contracts on Etherscan"
)
  .addOptionalParam(
    "crowdfunding",
    "CrowdfundingUSDC address (defaults to last deployed)"
  )
  .addOptionalParam(
    "mftReward",
    "MFTRewardUSDC address (defaults to last deployed)"
  )
  .addOptionalParam("usdc", "Constructor arg: USDC address")
  .addOptionalParam("goal", "Constructor arg: funding goal in USDC")
  .addOptionalParam("duration", "Constructor arg: duration in seconds")
  .setAction(async (taskArgs, hre) => {
    const network = hre.network.name;
    const record = loadDeployment(network);

    // CrowdfundingUSDC：地址与 args 都可用命令行覆盖，否则读记录
    const cfAddress = taskArgs.crowdfunding || record.crowdfunding.address;
    let cfArgs;
    if (taskArgs.usdc && taskArgs.goal && taskArgs.duration) {
      cfArgs = [
        taskArgs.usdc,
        hre.ethers.parseUnits(taskArgs.goal, 6).toString(),
        String(taskArgs.duration),
      ];
    } else {
      cfArgs = record.crowdfunding.args;
    }
    await verifyOne(hre, "CrowdfundingUSDC", cfAddress, cfArgs);

    // MFTRewardUSDC：constructor 只依赖 crowdfunding 地址
    const mftAddress = taskArgs.mftReward || record.mftReward.address;
    const mftArgs = [cfAddress];
    await verifyOne(hre, "MFTRewardUSDC", mftAddress, mftArgs);
  });

module.exports = {};
