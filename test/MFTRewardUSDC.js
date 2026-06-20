const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

// USDC 6 decimals
const USDC = (n) => ethers.parseUnits(String(n), 6);
// MFT 18 decimals
const MFT = (n) => ethers.parseEther(String(n));

describe("MFTRewardUSDC", function () {
  async function deployMFTRewardUSDCFixture() {
    const GOAL = USDC(1000); // 1000 USDC
    const SEVEN_DAYS = 7 * 24 * 60 * 60;
    const [owner, funder, other] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const CrowdfundingUSDC = await ethers.getContractFactory("CrowdfundingUSDC");
    const crowdfunding = await CrowdfundingUSDC.deploy(
      await usdc.getAddress(),
      GOAL,
      SEVEN_DAYS
    );
    const deadline = await crowdfunding.deadline();

    const MFTRewardUSDC = await ethers.getContractFactory("MFTRewardUSDC");
    const mftReward = await MFTRewardUSDC.deploy(await crowdfunding.getAddress());

    // 给 funder / owner 铸一些 USDC 供捐款
    await usdc.mint(funder.address, USDC(10000));
    await usdc.mint(owner.address, USDC(10000));

    return { usdc, crowdfunding, mftReward, deadline, GOAL, owner, funder, other };
  }

  // 辅助：approve + fund
  async function approveAndFund(usdc, crowdfunding, signer, amount) {
    await usdc.connect(signer).approve(crowdfunding, amount);
    await crowdfunding.connect(signer).fund(amount);
  }

  describe("ERC20 Metadata", function () {
    it("Should have the right name", async function () {
      const { mftReward } = await loadFixture(deployMFTRewardUSDCFixture);
      expect(await mftReward.name()).to.equal("MFT");
    });

    it("Should have the right symbol", async function () {
      const { mftReward } = await loadFixture(deployMFTRewardUSDCFixture);
      expect(await mftReward.symbol()).to.equal("MFT");
    });

    it("Should have 18 decimals", async function () {
      const { mftReward } = await loadFixture(deployMFTRewardUSDCFixture);
      expect(await mftReward.decimals()).to.equal(18);
    });

    it("Should start with zero total supply", async function () {
      const { mftReward } = await loadFixture(deployMFTRewardUSDCFixture);
      expect(await mftReward.totalSupply()).to.equal(0);
    });
  });

  describe("Deployment", function () {
    it("Should link the Crowdfunding contract", async function () {
      const { crowdfunding, mftReward } = await loadFixture(
        deployMFTRewardUSDCFixture
      );
      expect(await mftReward.crowdfunding()).to.equal(
        await crowdfunding.getAddress()
      );
    });

    it("Should set REWARD_RATE to 10^13", async function () {
      const { mftReward } = await loadFixture(deployMFTRewardUSDCFixture);
      expect(await mftReward.REWARD_RATE()).to.equal(10n ** 13n);
    });
  });

  describe("claimReward Validations", function () {
    it("Should revert while the campaign is still active", async function () {
      const { usdc, crowdfunding, mftReward, funder } = await loadFixture(
        deployMFTRewardUSDCFixture
      );
      await approveAndFund(usdc, crowdfunding, funder, USDC(1000));
      await expect(mftReward.connect(funder).claimReward()).to.be.revertedWith(
        "Campaign still active"
      );
    });

    it("Should revert if the goal was not reached", async function () {
      const { usdc, crowdfunding, mftReward, funder, deadline } =
        await loadFixture(deployMFTRewardUSDCFixture);
      await approveAndFund(usdc, crowdfunding, funder, USDC(500));
      await time.increaseTo(deadline);
      await expect(mftReward.connect(funder).claimReward()).to.be.revertedWith(
        "Goal not reached"
      );
    });

    it("Should revert if the caller contributed nothing", async function () {
      const { usdc, crowdfunding, mftReward, funder, other, deadline } =
        await loadFixture(deployMFTRewardUSDCFixture);
      await approveAndFund(usdc, crowdfunding, funder, USDC(1000)); // 凑齐目标
      await time.increaseTo(deadline);
      await expect(mftReward.connect(other).claimReward()).to.be.revertedWith(
        "No contribution to reward"
      );
    });

    it("Should revert on a double claim", async function () {
      const { usdc, crowdfunding, mftReward, funder, deadline } =
        await loadFixture(deployMFTRewardUSDCFixture);
      await approveAndFund(usdc, crowdfunding, funder, USDC(1000));
      await time.increaseTo(deadline);
      await mftReward.connect(funder).claimReward();
      await expect(mftReward.connect(funder).claimReward()).to.be.revertedWith(
        "Already claimed"
      );
    });
  });

  describe("claimReward Success", function () {
    it("Should mint 10000 MFT for a 1000 USDC contribution (1 USDC = 10 MFT)", async function () {
      const { usdc, crowdfunding, mftReward, funder, deadline } =
        await loadFixture(deployMFTRewardUSDCFixture);
      await approveAndFund(usdc, crowdfunding, funder, USDC(1000));
      await time.increaseTo(deadline);

      await mftReward.connect(funder).claimReward();

      expect(await mftReward.balanceOf(funder.address)).to.equal(MFT(10000));
      expect(await mftReward.claimed(funder.address)).to.equal(true);
      expect(await mftReward.totalSupply()).to.equal(MFT(10000));
    });

    it("Should scale proportionally (500 USDC -> 5000 MFT)", async function () {
      const { usdc, crowdfunding, mftReward, funder, owner, deadline } =
        await loadFixture(deployMFTRewardUSDCFixture);
      // funder 捐 500，owner 补 500 凑齐目标
      await approveAndFund(usdc, crowdfunding, funder, USDC(500));
      await approveAndFund(usdc, crowdfunding, owner, USDC(500));
      await time.increaseTo(deadline);

      await mftReward.connect(funder).claimReward();

      expect(await mftReward.balanceOf(funder.address)).to.equal(MFT(5000));
    });
  });

  describe("Events", function () {
    it("Should emit RewardClaimed on claim", async function () {
      const { usdc, crowdfunding, mftReward, funder, deadline } =
        await loadFixture(deployMFTRewardUSDCFixture);
      await approveAndFund(usdc, crowdfunding, funder, USDC(1000));
      await time.increaseTo(deadline);

      await expect(mftReward.connect(funder).claimReward())
        .to.emit(mftReward, "RewardClaimed")
        .withArgs(funder.address, MFT(10000));
    });
  });
});
