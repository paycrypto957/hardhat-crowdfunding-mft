const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe("MFTReward", function () {
  // 先部署 Crowdfunding，再用其地址部署 MFTReward。
  async function deployMFTRewardFixture() {
    const ONE_ETH = ethers.parseEther("1");
    const SEVEN_DAYS = 7 * 24 * 60 * 60;

    const [owner, funder, other] = await ethers.getSigners();

    const Crowdfunding = await ethers.getContractFactory("Crowdfunding");
    const crowdfunding = await Crowdfunding.deploy(ONE_ETH, SEVEN_DAYS);
    // 从合约读权威 deadline，避免与部署前 time.latest() 的 1 秒时序偏差
    const deadline = await crowdfunding.deadline();

    const MFTReward = await ethers.getContractFactory("MFTReward");
    const mftReward = await MFTReward.deploy(await crowdfunding.getAddress());

    return { crowdfunding, mftReward, deadline, owner, funder, other };
  }

  describe("ERC20 Metadata", function () {
    it("Should have the right name", async function () {
      const { mftReward } = await loadFixture(deployMFTRewardFixture);
      expect(await mftReward.name()).to.equal("MFT");
    });

    it("Should have the right symbol", async function () {
      const { mftReward } = await loadFixture(deployMFTRewardFixture);
      expect(await mftReward.symbol()).to.equal("MFT");
    });

    it("Should have 18 decimals", async function () {
      const { mftReward } = await loadFixture(deployMFTRewardFixture);
      expect(await mftReward.decimals()).to.equal(18);
    });

    it("Should start with zero total supply", async function () {
      const { mftReward } = await loadFixture(deployMFTRewardFixture);
      expect(await mftReward.totalSupply()).to.equal(0);
    });
  });

  describe("Deployment", function () {
    it("Should link the Crowdfunding contract", async function () {
      const { crowdfunding, mftReward } = await loadFixture(
        deployMFTRewardFixture
      );
      expect(await mftReward.crowdfunding()).to.equal(
        await crowdfunding.getAddress()
      );
    });

    it("Should set REWARD_RATE to 1000", async function () {
      const { mftReward } = await loadFixture(deployMFTRewardFixture);
      expect(await mftReward.REWARD_RATE()).to.equal(1000);
    });
  });

  describe("claimReward Validations", function () {
    it("Should revert while the campaign is still active", async function () {
      const { crowdfunding, mftReward, funder } = await loadFixture(
        deployMFTRewardFixture
      );
      // 已达标但尚未到期
      await crowdfunding
        .connect(funder)
        .fund({ value: ethers.parseEther("1") });

      await expect(mftReward.connect(funder).claimReward()).to.be.revertedWith(
        "Campaign still active"
      );
    });

    it("Should revert if the goal was not reached", async function () {
      const { crowdfunding, mftReward, funder, deadline } = await loadFixture(
        deployMFTRewardFixture
      );
      // 只筹到一半，到期
      await crowdfunding
        .connect(funder)
        .fund({ value: ethers.parseEther("0.5") });
      await time.increaseTo(deadline);

      await expect(mftReward.connect(funder).claimReward()).to.be.revertedWith(
        "Goal not reached"
      );
    });

    it("Should revert if the caller contributed nothing", async function () {
      const { crowdfunding, mftReward, funder, other, deadline } =
        await loadFixture(deployMFTRewardFixture);
      // 由 funder 凑齐目标，other 没捐过
      await crowdfunding
        .connect(funder)
        .fund({ value: ethers.parseEther("1") });
      await time.increaseTo(deadline);

      await expect(mftReward.connect(other).claimReward()).to.be.revertedWith(
        "No contribution to reward"
      );
    });

    it("Should revert on a double claim", async function () {
      const { crowdfunding, mftReward, funder, deadline } = await loadFixture(
        deployMFTRewardFixture
      );
      await crowdfunding
        .connect(funder)
        .fund({ value: ethers.parseEther("1") });
      await time.increaseTo(deadline);

      await mftReward.connect(funder).claimReward();

      await expect(mftReward.connect(funder).claimReward()).to.be.revertedWith(
        "Already claimed"
      );
    });
  });

  describe("claimReward Success", function () {
    it("Should mint 1000 MFT for a 1 ETH contribution (1 ETH = 1000 MFT)", async function () {
      const { crowdfunding, mftReward, funder, deadline } = await loadFixture(
        deployMFTRewardFixture
      );
      await crowdfunding
        .connect(funder)
        .fund({ value: ethers.parseEther("1") });
      await time.increaseTo(deadline);

      await mftReward.connect(funder).claimReward();

      expect(await mftReward.balanceOf(funder.address)).to.equal(
        ethers.parseEther("1000")
      );
      expect(await mftReward.claimed(funder.address)).to.equal(true);
      expect(await mftReward.totalSupply()).to.equal(
        ethers.parseEther("1000")
      );
    });

    it("Should scale proportionally (0.5 ETH -> 500 MFT)", async function () {
      const { crowdfunding, mftReward, funder, deadline } = await loadFixture(
        deployMFTRewardFixture
      );
      // 分两次凑齐目标，但 funder 实际只捐 0.5 ETH，验证按本人捐款额发奖
      await crowdfunding
        .connect(funder)
        .fund({ value: ethers.parseEther("0.5") });
      // 再由 owner 补齐到目标，使众筹达标
      await crowdfunding.fund({ value: ethers.parseEther("0.5") });
      await time.increaseTo(deadline);

      await mftReward.connect(funder).claimReward();

      expect(await mftReward.balanceOf(funder.address)).to.equal(
        ethers.parseEther("500")
      );
    });
  });

  describe("Events", function () {
    it("Should emit RewardClaimed on claim", async function () {
      const { crowdfunding, mftReward, funder, deadline } = await loadFixture(
        deployMFTRewardFixture
      );
      await crowdfunding
        .connect(funder)
        .fund({ value: ethers.parseEther("1") });
      await time.increaseTo(deadline);

      await expect(mftReward.connect(funder).claimReward())
        .to.emit(mftReward, "RewardClaimed")
        .withArgs(funder.address, ethers.parseEther("1000"));
    });
  });
});
