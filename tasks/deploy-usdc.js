// 自定义 Hardhat task：部署 USDC 版众筹三件套，并记录地址供 verify 使用。
// 本地网络（localhost/hardhat）会自动先部署 MockUSDC 作替身；
// 线上网络用 --usdc（默认 Sepolia 真实 USDC 地址）。
// 用法：npx hardhat deploy-usdc --network localhost
//      npx hardhat deploy-usdc --network sepolia --goal 2000 --duration 3600

const { task } = require("hardhat/config");
const fs = require("fs");
const path = require("path");

const DEPLOYMENT_FILE = path.join(
  __dirname,
  "..",
  ".crowdfunding-usdc-deployment.json"
);

// Sepolia 真实 USDC（生产用）
const SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

task(
  "deploy-usdc",
  "Deploy the USDC crowdfunding stack (MockUSDC locally + CrowdfundingUSDC + MFTRewardUSDC)"
)
  .addOptionalParam(
    "usdc",
    "USDC token address (used on live networks; local auto-deploys MockUSDC)",
    SEPOLIA_USDC
  )
  .addOptionalParam("goal", "Funding goal in USDC (e.g. 1000, 0.5)", "1000")
  .addOptionalParam(
    "duration",
    "Campaign duration in seconds",
    String(7 * 24 * 60 * 60)
  )
  .setAction(async (taskArgs, hre) => {
    const goalUnits = hre.ethers.parseUnits(taskArgs.goal, 6); // USDC 6 decimals
    const duration = BigInt(taskArgs.duration);
    const isLocal =
      hre.network.name === "localhost" || hre.network.name === "hardhat";

    // 1. 确定 USDC 地址：本地自动部署 MockUSDC；线上用传入/默认真实地址
    let usdcAddress;
    if (isLocal) {
      const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
      const mock = await MockUSDC.deploy();
      await mock.waitForDeployment();
      usdcAddress = await mock.getAddress();
      console.log(`Local network: deployed MockUSDC at ${usdcAddress}`);
    } else {
      usdcAddress = taskArgs.usdc;
      console.log(`Using USDC at ${usdcAddress}`);
    }

    // 2. 部署 CrowdfundingUSDC
    const CrowdfundingUSDC = await hre.ethers.getContractFactory(
      "CrowdfundingUSDC"
    );
    console.log(
      `Deploying CrowdfundingUSDC (goal=${taskArgs.goal} USDC, duration=${taskArgs.duration}s) on "${hre.network.name}"...`
    );
    const crowdfunding = await CrowdfundingUSDC.deploy(
      usdcAddress,
      goalUnits,
      duration
    );
    await crowdfunding.waitForDeployment();
    const crowdfundingAddress = await crowdfunding.getAddress();
    console.log(`CrowdfundingUSDC deployed to: ${crowdfundingAddress}`);

    // 3. 部署 MFTRewardUSDC，关联 CrowdfundingUSDC
    const MFTRewardUSDC = await hre.ethers.getContractFactory("MFTRewardUSDC");
    const mftReward = await MFTRewardUSDC.deploy(crowdfundingAddress);
    await mftReward.waitForDeployment();
    const mftAddress = await mftReward.getAddress();
    console.log(`MFTRewardUSDC deployed to:    ${mftAddress}`);

    // 4. 记录地址 + constructor 入参（verify 用），按 network 存
    const records = fs.existsSync(DEPLOYMENT_FILE)
      ? JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf8"))
      : {};
    records[hre.network.name] = {
      usdc: usdcAddress,
      crowdfunding: {
        address: crowdfundingAddress,
        // constructorArguments: [usdc地址, goal(USDC最小单位字符串), duration(秒字符串)]
        args: [usdcAddress, goalUnits.toString(), taskArgs.duration],
        txHash: crowdfunding.deploymentTransaction().hash,
      },
      mftReward: {
        address: mftAddress,
        args: [crowdfundingAddress],
        txHash: mftReward.deploymentTransaction().hash,
      },
    };
    fs.writeFileSync(DEPLOYMENT_FILE, JSON.stringify(records, null, 2));
    console.log(`Deployment info saved to ${DEPLOYMENT_FILE}`);
  });

module.exports = {};
