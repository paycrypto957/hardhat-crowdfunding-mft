const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("Crowdfunding", function () {
  // 我们定义一个 fixture 来复用相同的部署设置。
  // loadFixture 会运行一次部署、把状态快照下来，并在每个测试前重置到该快照。
  async function deployCrowdfundingFixture() {
    const ONE_ETH = ethers.parseEther("1");
    const SEVEN_DAYS = 7 * 24 * 60 * 60;

    // 合约默认由第一个 signer（owner）部署
    const [owner, otherAccount, otherAccount2] = await ethers.getSigners();

    const Crowdfunding = await ethers.getContractFactory("Crowdfunding");
    const crowdfunding = await Crowdfunding.deploy(ONE_ETH, SEVEN_DAYS);

    // 从合约读取权威 deadline。constructor 内用的是部署区块的 block.timestamp，
    // 与部署前 time.latest() 会差 1 秒（Hardhat automine 每区块 +1s），
    // 故以合约实际值为准，后续 increaseTo 也用它，避免时序偏差。
    const deadline = await crowdfunding.deadline();

    return {
      crowdfunding,
      goal: ONE_ETH,
      deadline,
      duration: SEVEN_DAYS,
      owner,
      otherAccount,
      otherAccount2,
    };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { crowdfunding, owner } = await loadFixture(
        deployCrowdfundingFixture
      );

      expect(await crowdfunding.owner()).to.equal(owner.address);
    });

    it("Should set the right goal", async function () {
      const { crowdfunding, goal } = await loadFixture(
        deployCrowdfundingFixture
      );

      expect(await crowdfunding.goal()).to.equal(goal);
    });

    it("Should set a deadline roughly now + duration", async function () {
      const { crowdfunding, duration } = await loadFixture(
        deployCrowdfundingFixture
      );

      const latest = await time.latest();
      const deadline = await crowdfunding.deadline();

      // deadline = 部署区块时间戳 + duration，允许几秒抖动
      expect(Number(deadline) - latest).to.be.closeTo(duration, 3);
    });

    it("Should start with zero raised", async function () {
      const { crowdfunding } = await loadFixture(deployCrowdfundingFixture);

      expect(await crowdfunding.totalRaised()).to.equal(0);
    });

    it("Should fail if the goal is zero", async function () {
      const Crowdfunding = await ethers.getContractFactory("Crowdfunding");
      await expect(Crowdfunding.deploy(0, 100)).to.be.revertedWith(
        "Goal must be greater than zero"
      );
    });

    it("Should fail if the duration is zero", async function () {
      const ONE_ETH = ethers.parseEther("1");
      const Crowdfunding = await ethers.getContractFactory("Crowdfunding");
      await expect(Crowdfunding.deploy(ONE_ETH, 0)).to.be.revertedWith(
        "Duration must be greater than zero"
      );
    });
  });

  describe("Funding", function () {
    it("Should accept a valid contribution", async function () {
      const { crowdfunding } = await loadFixture(deployCrowdfundingFixture);

      await expect(
        crowdfunding.fund({ value: ethers.parseEther("0.5") })
      ).not.to.be.reverted;
    });

    it("Should increase totalRaised", async function () {
      const { crowdfunding } = await loadFixture(deployCrowdfundingFixture);

      await crowdfunding.fund({ value: ethers.parseEther("0.5") });

      expect(await crowdfunding.totalRaised()).to.equal(
        ethers.parseEther("0.5")
      );
    });

    it("Should record the per-address contribution", async function () {
      const { crowdfunding, otherAccount } = await loadFixture(
        deployCrowdfundingFixture
      );

      await crowdfunding
        .connect(otherAccount)
        .fund({ value: ethers.parseEther("0.3") });

      expect(await crowdfunding.contributions(otherAccount.address)).to.equal(
        ethers.parseEther("0.3")
      );
    });

    it("Should accumulate multiple contributions", async function () {
      const { crowdfunding, otherAccount } = await loadFixture(
        deployCrowdfundingFixture
      );

      await crowdfunding
        .connect(otherAccount)
        .fund({ value: ethers.parseEther("0.2") });
      await crowdfunding
        .connect(otherAccount)
        .fund({ value: ethers.parseEther("0.3") });

      expect(await crowdfunding.contributions(otherAccount.address)).to.equal(
        ethers.parseEther("0.5")
      );
      expect(await crowdfunding.totalRaised()).to.equal(
        ethers.parseEther("0.5")
      );
    });

    it("Should revert if no ETH is sent", async function () {
      const { crowdfunding } = await loadFixture(deployCrowdfundingFixture);

      await expect(crowdfunding.fund({ value: 0 })).to.be.revertedWith(
        "Must send ETH to fund"
      );
    });

    it("Should revert if funding after the deadline", async function () {
      const { crowdfunding, deadline } = await loadFixture(
        deployCrowdfundingFixture
      );

      await time.increaseTo(deadline);

      await expect(crowdfunding.fund({ value: 1 })).to.be.revertedWith(
        "Campaign has ended"
      );
    });
  });

  describe("Withdrawal", function () {
    it("Should revert before the deadline", async function () {
      const { crowdfunding } = await loadFixture(deployCrowdfundingFixture);

      await expect(crowdfunding.withdraw()).to.be.revertedWith(
        "Campaign is still active"
      );
    });

    it("Should revert if the goal is not reached", async function () {
      const { crowdfunding, deadline } = await loadFixture(
        deployCrowdfundingFixture
      );

      await crowdfunding.fund({ value: ethers.parseEther("0.5") });
      await time.increaseTo(deadline);

      await expect(crowdfunding.withdraw()).to.be.revertedWith(
        "Goal not reached"
      );
    });

    it("Should revert if called by a non-owner", async function () {
      const { crowdfunding, otherAccount, deadline } = await loadFixture(
        deployCrowdfundingFixture
      );

      await crowdfunding.fund({ value: ethers.parseEther("1") });
      await time.increaseTo(deadline);

      await expect(
        crowdfunding.connect(otherAccount).withdraw()
      ).to.be.revertedWith("Only the owner can call this");
    });

    it("Should let the owner withdraw when goal reached and deadline passed", async function () {
      const { crowdfunding, deadline } = await loadFixture(
        deployCrowdfundingFixture
      );

      await crowdfunding.fund({ value: ethers.parseEther("1") });
      await time.increaseTo(deadline);

      await expect(crowdfunding.withdraw()).not.to.be.reverted;
    });

    it("Should fail on a double withdraw", async function () {
      const { crowdfunding, deadline } = await loadFixture(
        deployCrowdfundingFixture
      );

      await crowdfunding.fund({ value: ethers.parseEther("1") });
      await time.increaseTo(deadline);

      await crowdfunding.withdraw();

      await expect(crowdfunding.withdraw()).to.be.revertedWith(
        "Already withdrawn"
      );
    });

    it("Should mark withdrawn as true after withdraw", async function () {
      const { crowdfunding, deadline } = await loadFixture(
        deployCrowdfundingFixture
      );

      await crowdfunding.fund({ value: ethers.parseEther("1") });
      await time.increaseTo(deadline);

      await crowdfunding.withdraw();

      expect(await crowdfunding.withdrawn()).to.equal(true);
    });

    it("Should transfer the raised funds to the owner", async function () {
      const { crowdfunding, owner, deadline } = await loadFixture(
        deployCrowdfundingFixture
      );

      const raised = ethers.parseEther("1");
      await crowdfunding.fund({ value: raised });
      await time.increaseTo(deadline);

      // owner 同时是交易发起方，余额净变化 = 收款 - gas，故金额用 anyValue
      await expect(crowdfunding.withdraw())
        .to.emit(crowdfunding, "Withdrawn")
        .withArgs(owner.address, raised);
      expect(await crowdfunding.withdrawn()).to.equal(true);
    });
  });

  describe("Refund", function () {
    it("Should revert while the campaign is still active", async function () {
      const { crowdfunding, otherAccount } = await loadFixture(
        deployCrowdfundingFixture
      );

      await crowdfunding
        .connect(otherAccount)
        .fund({ value: ethers.parseEther("0.3") });

      await expect(
        crowdfunding.connect(otherAccount).claimRefund()
      ).to.be.revertedWith("Campaign is still active");
    });

    it("Should revert if the goal was reached", async function () {
      const { crowdfunding, otherAccount, deadline } = await loadFixture(
        deployCrowdfundingFixture
      );

      await crowdfunding
        .connect(otherAccount)
        .fund({ value: ethers.parseEther("1") });
      await time.increaseTo(deadline);

      await expect(
        crowdfunding.connect(otherAccount).claimRefund()
      ).to.be.revertedWith("Goal reached, no refund");
    });

    it("Should revert if the caller contributed nothing", async function () {
      const { crowdfunding, otherAccount2, deadline } = await loadFixture(
        deployCrowdfundingFixture
      );

      await time.increaseTo(deadline);

      await expect(
        crowdfunding.connect(otherAccount2).claimRefund()
      ).to.be.revertedWith("Nothing to refund");
    });

    it("Should refund the full contribution to the funder", async function () {
      const { crowdfunding, otherAccount, deadline } = await loadFixture(
        deployCrowdfundingFixture
      );

      const contributed = ethers.parseEther("0.3");
      await crowdfunding
        .connect(otherAccount)
        .fund({ value: contributed });
      await time.increaseTo(deadline);

      await expect(
        crowdfunding.connect(otherAccount).claimRefund()
      ).to.changeEtherBalances(
        [otherAccount, crowdfunding],
        [contributed, -contributed]
      );
    });

    it("Should zero out the contribution after refund", async function () {
      const { crowdfunding, otherAccount, deadline } = await loadFixture(
        deployCrowdfundingFixture
      );

      await crowdfunding
        .connect(otherAccount)
        .fund({ value: ethers.parseEther("0.3") });
      await time.increaseTo(deadline);

      await crowdfunding.connect(otherAccount).claimRefund();

      expect(await crowdfunding.contributions(otherAccount.address)).to.equal(
        0
      );
    });

    it("Should not allow a double refund", async function () {
      const { crowdfunding, otherAccount, deadline } = await loadFixture(
        deployCrowdfundingFixture
      );

      await crowdfunding
        .connect(otherAccount)
        .fund({ value: ethers.parseEther("0.3") });
      await time.increaseTo(deadline);

      await crowdfunding.connect(otherAccount).claimRefund();

      await expect(
        crowdfunding.connect(otherAccount).claimRefund()
      ).to.be.revertedWith("Nothing to refund");
    });
  });

  describe("Events", function () {
    it("Should emit Funded on contribution", async function () {
      const { crowdfunding, owner } = await loadFixture(
        deployCrowdfundingFixture
      );

      const amount = ethers.parseEther("0.5");
      await expect(crowdfunding.fund({ value: amount }))
        .to.emit(crowdfunding, "Funded")
        .withArgs(owner.address, amount, amount); // 首笔，totalRaised 也等于 amount
    });

    it("Should emit Withdrawn on owner withdraw", async function () {
      const { crowdfunding, owner, deadline } = await loadFixture(
        deployCrowdfundingFixture
      );

      const raised = ethers.parseEther("1");
      await crowdfunding.fund({ value: raised });
      await time.increaseTo(deadline);

      await expect(crowdfunding.withdraw())
        .to.emit(crowdfunding, "Withdrawn")
        .withArgs(owner.address, raised);
    });

    it("Should emit Refunded on claimRefund", async function () {
      const { crowdfunding, otherAccount, deadline } = await loadFixture(
        deployCrowdfundingFixture
      );

      const contributed = ethers.parseEther("0.3");
      await crowdfunding
        .connect(otherAccount)
        .fund({ value: contributed });
      await time.increaseTo(deadline);

      await expect(crowdfunding.connect(otherAccount).claimRefund())
        .to.emit(crowdfunding, "Refunded")
        .withArgs(otherAccount.address, contributed);
    });
  });
});
