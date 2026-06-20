// 自定义 Hardhat task：用 ethers.js 部署 Crowdfunding，并记录地址供 verify 使用。
// 用法：npx hardhat deploy --network localhost
//      npx hardhat deploy --network sepolia --goal 2 --duration 3600

const { task } = require("hardhat/config");
const fs = require("fs");
const path = require("path");

const DEPLOYMENT_FILE = path.join(
  __dirname,
  "..",
  ".crowdfunding-deployment.json"
);

task("deploy", "Deploy the Crowdfunding contract")
  .addOptionalParam("goal", "Funding goal in ETH (e.g. 1, 0.5)", "1")
  .addOptionalParam(
    "duration",
    "Campaign duration in seconds",
    String(7 * 24 * 60 * 60)
  )
  .setAction(async (taskArgs, hre) => {
    const goalWei = hre.ethers.parseEther(taskArgs.goal);
    const duration = BigInt(taskArgs.duration);

    const Crowdfunding = await hre.ethers.getContractFactory("Crowdfunding");
    console.log(
      `Deploying Crowdfunding (goal=${taskArgs.goal} ETH, duration=${taskArgs.duration}s) on "${hre.network.name}"...`
    );

    const crowdfunding = await Crowdfunding.deploy(goalWei, duration);
    await crowdfunding.waitForDeployment();

    const address = await crowdfunding.getAddress();
    const txHash = crowdfunding.deploymentTransaction().hash;

    console.log(`Crowdfunding deployed to: ${address}`);
    console.log(`Tx hash:               ${txHash}`);

    // 把地址和 constructor 原始入参按 network 记录下来，verify task 会读取它
    const records = fs.existsSync(DEPLOYMENT_FILE)
      ? JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf8"))
      : {};
    records[hre.network.name] = {
      address,
      // constructorArguments 的原始值：goal 以 wei 字符串、duration 以秒字符串
      args: [goalWei.toString(), taskArgs.duration],
      txHash,
    };
    fs.writeFileSync(DEPLOYMENT_FILE, JSON.stringify(records, null, 2));
    console.log(`Deployment info saved to ${DEPLOYMENT_FILE}`);
  });

module.exports = {};
