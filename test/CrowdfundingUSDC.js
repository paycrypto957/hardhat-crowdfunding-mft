const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

// USDC 是 6 decimals：把人类可读的 USDC 数转成最小单位
const USDC = (n) => ethers.parseUnits(String(n), 6);

describe("CrowdfundingUSDC", function () {
  async function deployCrowdfundingUSDCFixture() {
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

    // 给测试账户铸一些 USDC
    await usdc.mint(funder.address, USDC(10000));
    await usdc.mint(other.address, USDC(10000));

    return {
      usdc,
      crowdfunding,
      deadline,
      GOAL,
      SEVEN_DAYS,
      owner,
      funder,
      other,
    };
  }

  describe("Deployment", function () {
    it("Should link the USDC token", async function () {
      const { usdc, crowdfunding } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      expect(await crowdfunding.usdc()).to.equal(await usdc.getAddress());
    });

    it("Should set the right owner", async function () {
      const { crowdfunding, owner } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      expect(await crowdfunding.owner()).to.equal(owner.address);
    });

    it("Should set the right goal", async function () {
      const { crowdfunding, GOAL } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      expect(await crowdfunding.goal()).to.equal(GOAL);
    });

    it("Should set a deadline roughly now + duration", async function () {
      const { crowdfunding, SEVEN_DAYS } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      const latest = await time.latest();
      const deadline = await crowdfunding.deadline();
      expect(Number(deadline) - latest).to.be.closeTo(SEVEN_DAYS, 3);
    });

    it("Should start with zero raised", async function () {
      const { crowdfunding } = await loadFixture(deployCrowdfundingUSDCFixture);
      expect(await crowdfunding.totalRaised()).to.equal(0);
    });

    it("Should fail if the goal is zero", async function () {
      const { usdc } = await loadFixture(deployCrowdfundingUSDCFixture);
      const CF = await ethers.getContractFactory("CrowdfundingUSDC");
      await expect(CF.deploy(await usdc.getAddress(), 0, 100)).to.be.revertedWith(
        "Goal must be greater than zero"
      );
    });

    it("Should fail if the duration is zero", async function () {
      const { usdc, GOAL } = await loadFixture(deployCrowdfundingUSDCFixture);
      const CF = await ethers.getContractFactory("CrowdfundingUSDC");
      await expect(CF.deploy(await usdc.getAddress(), GOAL, 0)).to.be.revertedWith(
        "Duration must be greater than zero"
      );
    });
  });

  describe("Funding", function () {
    it("Should revert if the caller did not approve USDC", async function () {
      const { usdc, crowdfunding, funder } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      // 没 approve：OpenZeppelin v5 的 transferFrom 失败时会 revert custom error
      // （ERC20InsufficientAllowance），而不是返回 false。
      await expect(crowdfunding.connect(funder).fund(USDC(100)))
        .to.be.revertedWithCustomError(usdc, "ERC20InsufficientAllowance");
    });

    it("Should accept a contribution after approve", async function () {
      const { usdc, crowdfunding, funder } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(100));
      await expect(crowdfunding.connect(funder).fund(USDC(100))).not.to.be
        .reverted;
    });

    it("Should increase totalRaised", async function () {
      const { usdc, crowdfunding, funder } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(100));
      await crowdfunding.connect(funder).fund(USDC(100));
      expect(await crowdfunding.totalRaised()).to.equal(USDC(100));
    });

    it("Should record the per-address contribution", async function () {
      const { usdc, crowdfunding, funder } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(100));
      await crowdfunding.connect(funder).fund(USDC(100));
      expect(await crowdfunding.contributions(funder.address)).to.equal(
        USDC(100)
      );
    });

    it("Should accumulate multiple contributions", async function () {
      const { usdc, crowdfunding, funder } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(300));
      await crowdfunding.connect(funder).fund(USDC(100));
      await crowdfunding.connect(funder).fund(USDC(200));
      expect(await crowdfunding.contributions(funder.address)).to.equal(
        USDC(300)
      );
      expect(await crowdfunding.totalRaised()).to.equal(USDC(300));
    });

    it("Should pull USDC into the contract", async function () {
      const { usdc, crowdfunding, funder } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(100));
      await crowdfunding.connect(funder).fund(USDC(100));
      expect(await usdc.balanceOf(crowdfunding)).to.equal(USDC(100));
    });

    it("Should revert if amount is zero", async function () {
      const { usdc, crowdfunding, funder } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(100));
      await expect(crowdfunding.connect(funder).fund(0)).to.be.revertedWith(
        "Must fund positive amount"
      );
    });

    it("Should revert if funding after the deadline", async function () {
      const { usdc, crowdfunding, funder, deadline } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(100));
      await time.increaseTo(deadline);
      await expect(crowdfunding.connect(funder).fund(USDC(100))).to.be.revertedWith(
        "Campaign has ended"
      );
    });
  });

  describe("Withdrawal", function () {
    it("Should revert before the deadline", async function () {
      const { crowdfunding } = await loadFixture(deployCrowdfundingUSDCFixture);
      await expect(crowdfunding.withdraw()).to.be.revertedWith(
        "Campaign is still active"
      );
    });

    it("Should revert if the goal is not reached", async function () {
      const { usdc, crowdfunding, funder, deadline } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(500));
      await crowdfunding.connect(funder).fund(USDC(500));
      await time.increaseTo(deadline);
      await expect(crowdfunding.withdraw()).to.be.revertedWith(
        "Goal not reached"
      );
    });

    it("Should revert if called by a non-owner", async function () {
      const { usdc, crowdfunding, funder, deadline } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(1000));
      await crowdfunding.connect(funder).fund(USDC(1000));
      await time.increaseTo(deadline);
      await expect(crowdfunding.connect(funder).withdraw()).to.be.revertedWith(
        "Only the owner can call this"
      );
    });

    it("Should let the owner withdraw when goal reached and deadline passed", async function () {
      const { usdc, crowdfunding, funder, deadline } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(1000));
      await crowdfunding.connect(funder).fund(USDC(1000));
      await time.increaseTo(deadline);
      await expect(crowdfunding.withdraw()).not.to.be.reverted;
    });

    it("Should fail on a double withdraw", async function () {
      const { usdc, crowdfunding, funder, deadline } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(1000));
      await crowdfunding.connect(funder).fund(USDC(1000));
      await time.increaseTo(deadline);
      await crowdfunding.withdraw();
      await expect(crowdfunding.withdraw()).to.be.revertedWith(
        "Already withdrawn"
      );
    });

    it("Should transfer the raised USDC to the owner", async function () {
      const { usdc, crowdfunding, funder, owner, deadline } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(1000));
      await crowdfunding.connect(funder).fund(USDC(1000));
      await time.increaseTo(deadline);
      await expect(crowdfunding.withdraw()).to.changeTokenBalance(
        usdc,
        owner,
        USDC(1000)
      );
      expect(await crowdfunding.withdrawn()).to.equal(true);
    });
  });

  describe("Refund", function () {
    it("Should revert while the campaign is still active", async function () {
      const { usdc, crowdfunding, funder } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(300));
      await crowdfunding.connect(funder).fund(USDC(300));
      await expect(crowdfunding.connect(funder).claimRefund()).to.be.revertedWith(
        "Campaign is still active"
      );
    });

    it("Should revert if the goal was reached", async function () {
      const { usdc, crowdfunding, funder, deadline } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(1000));
      await crowdfunding.connect(funder).fund(USDC(1000));
      await time.increaseTo(deadline);
      await expect(crowdfunding.connect(funder).claimRefund()).to.be.revertedWith(
        "Goal reached, no refund"
      );
    });

    it("Should revert if the caller contributed nothing", async function () {
      const { crowdfunding, other, deadline } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await time.increaseTo(deadline);
      await expect(crowdfunding.connect(other).claimRefund()).to.be.revertedWith(
        "Nothing to refund"
      );
    });

    it("Should refund the full contribution", async function () {
      const { usdc, crowdfunding, funder, deadline } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(300));
      await crowdfunding.connect(funder).fund(USDC(300));
      await time.increaseTo(deadline);
      await expect(
        crowdfunding.connect(funder).claimRefund()
      ).to.changeTokenBalance(usdc, funder, USDC(300));
    });

    it("Should zero out the contribution after refund", async function () {
      const { usdc, crowdfunding, funder, deadline } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(300));
      await crowdfunding.connect(funder).fund(USDC(300));
      await time.increaseTo(deadline);
      await crowdfunding.connect(funder).claimRefund();
      expect(await crowdfunding.contributions(funder.address)).to.equal(0);
    });

    it("Should not allow a double refund", async function () {
      const { usdc, crowdfunding, funder, deadline } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(300));
      await crowdfunding.connect(funder).fund(USDC(300));
      await time.increaseTo(deadline);
      await crowdfunding.connect(funder).claimRefund();
      await expect(
        crowdfunding.connect(funder).claimRefund()
      ).to.be.revertedWith("Nothing to refund");
    });
  });

  describe("Events", function () {
    it("Should emit Funded on contribution", async function () {
      const { usdc, crowdfunding, funder } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(100));
      await expect(crowdfunding.connect(funder).fund(USDC(100)))
        .to.emit(crowdfunding, "Funded")
        .withArgs(funder.address, USDC(100), USDC(100));
    });

    it("Should emit Withdrawn on owner withdraw", async function () {
      const { usdc, crowdfunding, funder, owner, deadline } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(1000));
      await crowdfunding.connect(funder).fund(USDC(1000));
      await time.increaseTo(deadline);
      await expect(crowdfunding.withdraw())
        .to.emit(crowdfunding, "Withdrawn")
        .withArgs(owner.address, USDC(1000));
    });

    it("Should emit Refunded on claimRefund", async function () {
      const { usdc, crowdfunding, funder, deadline } = await loadFixture(
        deployCrowdfundingUSDCFixture
      );
      await usdc.connect(funder).approve(crowdfunding, USDC(300));
      await crowdfunding.connect(funder).fund(USDC(300));
      await time.increaseTo(deadline);
      await expect(crowdfunding.connect(funder).claimRefund())
        .to.emit(crowdfunding, "Refunded")
        .withArgs(funder.address, USDC(300));
    });
  });
});
