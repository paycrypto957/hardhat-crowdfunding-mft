// 自定义 Hardhat task：把 Crowdfunding 在 Etherscan 上做源码验证。
// 复用 hardhat-toolbox 自带的 verify:verify，自动填入地址和 constructor args。
// 用法：npx hardhat verify-crowdfunding --network sepolia
//      npx hardhat verify-crowdfunding --network sepolia --address 0x... --goal 1 --duration 604800

const { task } = require("hardhat/config");
const fs = require("fs");
const path = require("path");

const DEPLOYMENT_FILE = path.join(
  __dirname,
  "..",
  ".crowdfunding-deployment.json"
);

function loadDeployment(network) {
  if (!fs.existsSync(DEPLOYMENT_FILE)) {
    throw new Error(
      `No deployment record at ${DEPLOYMENT_FILE}. Run "npx hardhat deploy" first, or pass --address/--goal/--duration.`
    );
  }
  const records = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf8"));
  const record = records[network];
  if (!record) {
    throw new Error(
      `No deployment recorded for network "${network}". Available: ${Object.keys(
        records
      ).join(", ")}. Re-run deploy on this network or pass --address.`
    );
  }
  return record;
}

task("verify-crowdfunding", "Verify the Crowdfunding contract on Etherscan")
  .addOptionalParam(
    "address",
    "Contract address (defaults to the last deployed address on this network)"
  )
  .addOptionalParam("goal", "Constructor arg: funding goal in ETH")
  .addOptionalParam("duration", "Constructor arg: duration in seconds")
  .setAction(async (taskArgs, hre) => {
    const network = hre.network.name;
    let { address, goal, duration } = taskArgs;

    // 地址：优先命令行参数，否则读 deploy 记录
    if (!address) {
      address = loadDeployment(network).address;
      console.log(
        `No --address given; using last deployed address on "${network}": ${address}`
      );
    }

    // constructor args：两个都传了就用命令行的，否则用 deploy 记录里的
    let constructorArguments;
    if (goal !== undefined && duration !== undefined) {
      constructorArguments = [
        hre.ethers.parseEther(goal).toString(),
        String(duration),
      ];
    } else {
      constructorArguments = loadDeployment(network).args;
    }

    console.log(
      `Verifying ${address} with constructor args [${constructorArguments.join(
        ", "
      )}]...`
    );

    try {
      await hre.run("verify:verify", {
        address,
        constructorArguments,
      });
    } catch (err) {
      // 已经验证过的合约会抛错，属正常情况
      if (/already verified/i.test(err.message)) {
        console.log("Contract is already verified, nothing to do.");
        return;
      }
      throw err;
    }
  });

module.exports = {};
