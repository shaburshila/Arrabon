const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ConsultEscrow", function () {
  const MIN_PRICE = 10_000_000n;
  const MAX_PRICE = 1_000_000_000n;
  const FEE_BPS = 200n;
  const FEE_DENOMINATOR = 10_000n;
  const DISPUTE_WINDOW = 48n * 60n * 60n;

  async function deployFixture() {
    const [deployer, seller, buyer, treasury, admin, outsider] = await ethers.getSigners();
    const token = await ethers.deployContract("MockUSDC");
    const escrow = await ethers.deployContract("ConsultEscrow", [token.target, treasury.address, [admin.address]]);

    return { deployer, seller, buyer, treasury, admin, outsider, token, escrow };
  }

  async function deployReentrantFixture() {
    const [deployer, treasury, admin, outsider] = await ethers.getSigners();
    const token = await ethers.deployContract("ReentrantToken");
    const escrow = await ethers.deployContract("ConsultEscrow", [token.target, treasury.address, [admin.address]]);

    return { deployer, treasury, admin, outsider, token, escrow };
  }

  function feeFor(price) {
    return (price * FEE_BPS) / FEE_DENOMINATOR;
  }

  async function fundDeal({
    escrow,
    token,
    seller,
    buyer,
    price = MIN_PRICE,
    linkHash = ethers.keccak256(ethers.toUtf8Bytes("link-1")),
    durationMinutes = 60n,
    gracePeriodMinutes = 15n,
    scheduledAt,
  }) {
    const now = BigInt(await time.latest());
    const effectiveScheduledAt = scheduledAt ?? (now + 24n * 60n * 60n);
    const dealId = await escrow.nextDealId();

    await token.mint(buyer.address, price);
    await token.connect(buyer).approve(escrow.target, price);

    const tx = await escrow.connect(buyer).createAndFundDeal(
      linkHash,
      seller.address,
      buyer.address,
      price,
      effectiveScheduledAt,
      durationMinutes,
      gracePeriodMinutes
    );

    return {
      tx,
      dealId,
      linkHash,
      scheduledAt: effectiveScheduledAt,
      durationMinutes,
      gracePeriodMinutes,
      price,
    };
  }

  async function markCompletedAtThreshold({
    escrow,
    seller,
    dealId = 1n,
    scheduledAt,
    durationMinutes = 60n,
    gracePeriodMinutes = 15n,
  }) {
    const threshold = scheduledAt + durationMinutes * 60n + gracePeriodMinutes * 60n;
    await time.setNextBlockTimestamp(threshold);
    const tx = await escrow.connect(seller).markCompleted(dealId);
    return { tx, threshold };
  }

  describe("funding", function () {
    it("valid funding succeeds", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const price = 123_456_789n;
      const linkHash = ethers.keccak256(ethers.toUtf8Bytes("valid-funding"));
      const now = BigInt(await time.latest());
      const scheduledAt = now + 3600n;

      await token.mint(buyer.address, price);
      await token.connect(buyer).approve(escrow.target, price);

      await expect(
        escrow.connect(buyer).createAndFundDeal(
          linkHash,
          seller.address,
          buyer.address,
          price,
          scheduledAt,
          30,
          0
        )
      )
        .to.emit(escrow, "DealFunded")
        .withArgs(1n, linkHash, seller.address, buyer.address);

      const deal = await escrow.deals(1n);
      expect(deal.linkHash).to.equal(linkHash);
      expect(deal.seller).to.equal(seller.address);
      expect(deal.buyer).to.equal(buyer.address);
      expect(deal.price).to.equal(price);
      expect(deal.feeAmount).to.equal(feeFor(price));
      expect(deal.scheduledAt).to.equal(scheduledAt);
      expect(deal.durationMinutes).to.equal(30n);
      expect(deal.gracePeriodMinutes).to.equal(0n);
      expect(deal.completedAt).to.equal(0n);
      expect(deal.status).to.equal(1n);
      expect(await escrow.usedLinkHashes(linkHash)).to.equal(true);
      expect(await escrow.nextDealId()).to.equal(2n);
      expect(await token.balanceOf(escrow.target)).to.equal(price);
      expect(await token.balanceOf(await escrow.treasury())).to.equal(0n);
    });

    it("duplicate linkHash funding fails", async function () {
      const { seller, buyer, outsider, token, escrow } = await deployFixture();
      const linkHash = ethers.keccak256(ethers.toUtf8Bytes("duplicate-link"));
      const now = BigInt(await time.latest());
      const scheduledAt = now + 3600n;

      await token.mint(buyer.address, MIN_PRICE);
      await token.connect(buyer).approve(escrow.target, MIN_PRICE);
      await escrow.connect(buyer).createAndFundDeal(
        linkHash,
        seller.address,
        buyer.address,
        MIN_PRICE,
        scheduledAt,
        30,
        0
      );

      await token.mint(outsider.address, MIN_PRICE);
      await token.connect(outsider).approve(escrow.target, MIN_PRICE);

      await expect(
        escrow.connect(outsider).createAndFundDeal(
          linkHash,
          seller.address,
          outsider.address,
          MIN_PRICE,
          scheduledAt + 100n,
          30,
          0
        )
      ).to.be.revertedWithCustomError(escrow, "LinkHashAlreadyUsed");
    });

    it("buyer-only funding enforced", async function () {
      const { seller, buyer, outsider, token, escrow } = await deployFixture();
      const now = BigInt(await time.latest());
      const scheduledAt = now + 3600n;

      await token.mint(buyer.address, MIN_PRICE);
      await token.connect(buyer).approve(escrow.target, MIN_PRICE);

      await expect(
        escrow.connect(outsider).createAndFundDeal(
          ethers.keccak256(ethers.toUtf8Bytes("buyer-only")),
          seller.address,
          buyer.address,
          MIN_PRICE,
          scheduledAt,
          30,
          0
        )
      ).to.be.revertedWithCustomError(escrow, "UnauthorizedCaller");
    });

    it("seller cannot equal buyer", async function () {
      const { buyer, token, escrow } = await deployFixture();
      const now = BigInt(await time.latest());
      const scheduledAt = now + 3600n;

      await token.mint(buyer.address, MIN_PRICE);
      await token.connect(buyer).approve(escrow.target, MIN_PRICE);

      await expect(
        escrow.connect(buyer).createAndFundDeal(
          ethers.keccak256(ethers.toUtf8Bytes("same-party")),
          buyer.address,
          buyer.address,
          MIN_PRICE,
          scheduledAt,
          30,
          0
        )
      ).to.be.revertedWithCustomError(escrow, "UnauthorizedCaller");
    });

    it("price boundaries are enforced exactly", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const now = BigInt(await time.latest());
      const scheduledAt = now + 3600n;

      for (const amount of [9_999_999n, 10_000_000n, 1_000_000_000n, 1_000_000_001n]) {
        await token.mint(buyer.address, amount);
      }
      await token.connect(buyer).approve(escrow.target, 9_999_999n + 10_000_000n + 1_000_000_000n + 1_000_000_001n);

      await expect(
        escrow.connect(buyer).createAndFundDeal(
          ethers.keccak256(ethers.toUtf8Bytes("below-min")),
          seller.address,
          buyer.address,
          9_999_999n,
          scheduledAt,
          30,
          0
        )
      ).to.be.revertedWithCustomError(escrow, "InvalidPrice");

      await expect(
        escrow.connect(buyer).createAndFundDeal(
          ethers.keccak256(ethers.toUtf8Bytes("min-ok")),
          seller.address,
          buyer.address,
          10_000_000n,
          scheduledAt + 1n,
          30,
          0
        )
      ).to.not.be.reverted;

      await expect(
        escrow.connect(buyer).createAndFundDeal(
          ethers.keccak256(ethers.toUtf8Bytes("max-ok")),
          seller.address,
          buyer.address,
          1_000_000_000n,
          scheduledAt + 2n,
          30,
          0
        )
      ).to.not.be.reverted;

      await expect(
        escrow.connect(buyer).createAndFundDeal(
          ethers.keccak256(ethers.toUtf8Bytes("above-max")),
          seller.address,
          buyer.address,
          1_000_000_001n,
          scheduledAt + 3n,
          30,
          0
        )
      ).to.be.revertedWithCustomError(escrow, "InvalidPrice");
    });

    it("invalid schedule fails", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const now = BigInt(await time.latest());

      await token.mint(buyer.address, MIN_PRICE);
      await token.connect(buyer).approve(escrow.target, MIN_PRICE);

      await expect(
        escrow.connect(buyer).createAndFundDeal(
          ethers.keccak256(ethers.toUtf8Bytes("bad-schedule")),
          seller.address,
          buyer.address,
          MIN_PRICE,
          now,
          30,
          0
        )
      ).to.be.revertedWithCustomError(escrow, "InvalidSchedule");
    });

    it("invalid duration fails", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const now = BigInt(await time.latest());
      const scheduledAt = now + 3600n;

      await token.mint(buyer.address, MIN_PRICE);
      await token.connect(buyer).approve(escrow.target, MIN_PRICE);

      await expect(
        escrow.connect(buyer).createAndFundDeal(
          ethers.keccak256(ethers.toUtf8Bytes("bad-duration")),
          seller.address,
          buyer.address,
          MIN_PRICE,
          scheduledAt,
          0,
          0
        )
      ).to.be.revertedWithCustomError(escrow, "InvalidDuration");
    });
  });

  describe("markCompleted", function () {
    it("only seller can call", async function () {
      const { seller, buyer, outsider, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await time.setNextBlockTimestamp(
        funded.scheduledAt + funded.durationMinutes * 60n + funded.gracePeriodMinutes * 60n
      );

      await expect(escrow.connect(outsider).markCompleted(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "UnauthorizedCaller"
      );
    });

    it("fails before threshold", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      const threshold = funded.scheduledAt + funded.durationMinutes * 60n + funded.gracePeriodMinutes * 60n;
      await time.setNextBlockTimestamp(threshold - 1n);

      await expect(escrow.connect(seller).markCompleted(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "CompletionTooEarly"
      );
    });

    it("succeeds at exact threshold, writes completedAt correctly, and emits exact timestamp", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      const threshold = funded.scheduledAt + funded.durationMinutes * 60n + funded.gracePeriodMinutes * 60n;
      await time.setNextBlockTimestamp(threshold);

      const tx = await escrow.connect(seller).markCompleted(funded.dealId);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx).to.emit(escrow, "Completed").withArgs(funded.dealId, block.timestamp);

      const deal = await escrow.deals(funded.dealId);
      expect(deal.completedAt).to.equal(block.timestamp);
      expect(deal.status).to.equal(2n);
    });

    it("completedAt is set exactly once because repeat completion from ConfirmPending reverts", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded.dealId,
        scheduledAt: funded.scheduledAt,
        durationMinutes: funded.durationMinutes,
        gracePeriodMinutes: funded.gracePeriodMinutes,
      });

      const firstCompletedAt = (await escrow.deals(funded.dealId)).completedAt;

      await expect(escrow.connect(seller).markCompleted(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );

      expect((await escrow.deals(funded.dealId)).completedAt).to.equal(firstCompletedAt);
    });
  });

  describe("confirmRelease", function () {
    it("only buyer can call", async function () {
      const { seller, buyer, outsider, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded.dealId,
        scheduledAt: funded.scheduledAt,
        durationMinutes: funded.durationMinutes,
        gracePeriodMinutes: funded.gracePeriodMinutes,
      });

      await expect(escrow.connect(outsider).confirmRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "UnauthorizedCaller"
      );
    });

    it("only from ConfirmPending", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });

      await expect(escrow.connect(buyer).confirmRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );
    });

    it("allowed at exact deadline, pays seller net, pays treasury fee, and emits exact timestamp", async function () {
      const { seller, buyer, treasury, token, escrow } = await deployFixture();
      const price = 250_000_000n;
      const funded = await fundDeal({ escrow, token, seller, buyer, price });
      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded.dealId,
        scheduledAt: funded.scheduledAt,
        durationMinutes: funded.durationMinutes,
        gracePeriodMinutes: funded.gracePeriodMinutes,
      });

      const completedAt = (await escrow.deals(funded.dealId)).completedAt;
      const deadline = completedAt + DISPUTE_WINDOW;
      const fee = feeFor(price);
      const sellerNet = price - fee;

      await time.setNextBlockTimestamp(deadline);

      const tx = await escrow.connect(buyer).confirmRelease(funded.dealId);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx).to.emit(escrow, "Released").withArgs(funded.dealId, block.timestamp);

      const deal = await escrow.deals(funded.dealId);
      expect(deal.status).to.equal(3n);
      expect(await token.balanceOf(seller.address)).to.equal(sellerNet);
      expect(await token.balanceOf(treasury.address)).to.equal(fee);
      expect(await token.balanceOf(escrow.target)).to.equal(0n);
    });

    it("reverts after deadline", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded.dealId,
        scheduledAt: funded.scheduledAt,
        durationMinutes: funded.durationMinutes,
        gracePeriodMinutes: funded.gracePeriodMinutes,
      });

      const completedAt = (await escrow.deals(funded.dealId)).completedAt;
      await time.setNextBlockTimestamp(completedAt + DISPUTE_WINDOW + 1n);

      await expect(escrow.connect(buyer).confirmRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "ConfirmDisputeWindowExpired"
      );
    });
  });

  describe("openDispute", function () {
    it("only buyer can call", async function () {
      const { seller, buyer, outsider, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });

      await expect(escrow.connect(outsider).openDispute(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "UnauthorizedCaller"
      );
    });

    it("allowed from Funded with no deadline restriction", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await time.increase(365 * 24 * 60 * 60);

      await expect(escrow.connect(buyer).openDispute(funded.dealId))
        .to.emit(escrow, "Disputed")
        .withArgs(funded.dealId);

      expect((await escrow.deals(funded.dealId)).status).to.equal(5n);
    });

    it("allowed from ConfirmPending within deadline", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded.dealId,
        scheduledAt: funded.scheduledAt,
        durationMinutes: funded.durationMinutes,
        gracePeriodMinutes: funded.gracePeriodMinutes,
      });

      await expect(escrow.connect(buyer).openDispute(funded.dealId))
        .to.emit(escrow, "Disputed")
        .withArgs(funded.dealId);

      expect((await escrow.deals(funded.dealId)).status).to.equal(5n);
    });

    it("allowed from ConfirmPending at the exact deadline", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded.dealId,
        scheduledAt: funded.scheduledAt,
        durationMinutes: funded.durationMinutes,
        gracePeriodMinutes: funded.gracePeriodMinutes,
      });

      const completedAt = (await escrow.deals(funded.dealId)).completedAt;
      await time.setNextBlockTimestamp(completedAt + DISPUTE_WINDOW);

      await expect(escrow.connect(buyer).openDispute(funded.dealId))
        .to.emit(escrow, "Disputed")
        .withArgs(funded.dealId);

      expect((await escrow.deals(funded.dealId)).status).to.equal(5n);
    });

    it("blocked after deadline in ConfirmPending", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded.dealId,
        scheduledAt: funded.scheduledAt,
        durationMinutes: funded.durationMinutes,
        gracePeriodMinutes: funded.gracePeriodMinutes,
      });

      const completedAt = (await escrow.deals(funded.dealId)).completedAt;
      await time.setNextBlockTimestamp(completedAt + DISPUTE_WINDOW + 1n);

      await expect(escrow.connect(buyer).openDispute(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "ConfirmDisputeWindowExpired"
      );
    });

    it("reverts from Disputed, Released, and Refunded", async function () {
      const { seller, buyer, treasury, admin, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer, price: 100_000_000n });

      await escrow.connect(buyer).openDispute(funded.dealId);
      await expect(escrow.connect(buyer).openDispute(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );

      await escrow.connect(admin).adminResolveRefund(funded.dealId);
      await expect(escrow.connect(buyer).openDispute(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );

      const funded2 = await fundDeal({
        escrow,
        token,
        seller,
        buyer,
        price: 110_000_000n,
        linkHash: ethers.keccak256(ethers.toUtf8Bytes("release-terminal")),
        scheduledAt: (BigInt(await time.latest()) + 10_000n),
      });
      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded2.dealId,
        scheduledAt: funded2.scheduledAt,
        durationMinutes: funded2.durationMinutes,
        gracePeriodMinutes: funded2.gracePeriodMinutes,
      });
      const completedAt = (await escrow.deals(funded2.dealId)).completedAt;
      await time.setNextBlockTimestamp(completedAt + DISPUTE_WINDOW);
      await escrow.connect(buyer).confirmRelease(funded2.dealId);

      await expect(escrow.connect(buyer).openDispute(funded2.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );

      expect(await token.balanceOf(treasury.address)).to.be.greaterThan(0n);
    });
  });

  describe("autoRelease", function () {
    it("is permissionless", async function () {
      const { seller, buyer, outsider, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded.dealId,
        scheduledAt: funded.scheduledAt,
        durationMinutes: funded.durationMinutes,
        gracePeriodMinutes: funded.gracePeriodMinutes,
      });

      const completedAt = (await escrow.deals(funded.dealId)).completedAt;
      await time.setNextBlockTimestamp(completedAt + DISPUTE_WINDOW + 1n);

      await expect(escrow.connect(outsider).autoRelease(funded.dealId)).to.not.be.reverted;
    });

    it("reverts when status is Funded", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });

      await expect(escrow.autoRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );
    });

    it("fails at exact deadline", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded.dealId,
        scheduledAt: funded.scheduledAt,
        durationMinutes: funded.durationMinutes,
        gracePeriodMinutes: funded.gracePeriodMinutes,
      });
      const completedAt = (await escrow.deals(funded.dealId)).completedAt;
      await time.setNextBlockTimestamp(completedAt + DISPUTE_WINDOW);

      await expect(escrow.autoRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "AutoReleaseTooEarly"
      );
    });

    it("succeeds only after deadline and pays seller net plus treasury fee", async function () {
      const { seller, buyer, treasury, outsider, token, escrow } = await deployFixture();
      const price = 300_000_000n;
      const funded = await fundDeal({ escrow, token, seller, buyer, price });
      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded.dealId,
        scheduledAt: funded.scheduledAt,
        durationMinutes: funded.durationMinutes,
        gracePeriodMinutes: funded.gracePeriodMinutes,
      });
      const completedAt = (await escrow.deals(funded.dealId)).completedAt;
      await time.setNextBlockTimestamp(completedAt + DISPUTE_WINDOW + 1n);

      const tx = await escrow.connect(outsider).autoRelease(funded.dealId);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx).to.emit(escrow, "Released").withArgs(funded.dealId, block.timestamp);

      const fee = feeFor(price);
      expect(await token.balanceOf(seller.address)).to.equal(price - fee);
      expect(await token.balanceOf(treasury.address)).to.equal(fee);
      expect((await escrow.deals(funded.dealId)).status).to.equal(3n);
    });

    it("is blocked if deal already disputed", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await escrow.connect(buyer).openDispute(funded.dealId);

      await expect(escrow.autoRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );
    });
  });

  describe("admin resolution", function () {
    it("only admin can resolve", async function () {
      const { seller, buyer, outsider, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await escrow.connect(buyer).openDispute(funded.dealId);

      await expect(escrow.connect(outsider).adminResolveRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "CallerNotAdmin"
      );
      await expect(escrow.connect(outsider).adminResolveRefund(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "CallerNotAdmin"
      );
    });

    it("adminResolveRelease only from Disputed and returns net to seller plus fee to treasury", async function () {
      const { seller, buyer, treasury, admin, token, escrow } = await deployFixture();
      const price = 80_000_000n;
      const funded = await fundDeal({ escrow, token, seller, buyer, price });

      await expect(escrow.connect(admin).adminResolveRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );

      await escrow.connect(buyer).openDispute(funded.dealId);
      const tx = await escrow.connect(admin).adminResolveRelease(funded.dealId);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx).to.emit(escrow, "Released").withArgs(funded.dealId, block.timestamp);

      const fee = feeFor(price);
      expect(await token.balanceOf(seller.address)).to.equal(price - fee);
      expect(await token.balanceOf(treasury.address)).to.equal(fee);
      expect((await escrow.deals(funded.dealId)).status).to.equal(3n);
    });

    it("adminResolveRefund only from Disputed and refund returns full price to buyer", async function () {
      const { seller, buyer, admin, token, escrow } = await deployFixture();
      const price = 90_000_000n;
      const funded = await fundDeal({ escrow, token, seller, buyer, price });

      await expect(escrow.connect(admin).adminResolveRefund(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );

      await escrow.connect(buyer).openDispute(funded.dealId);
      await expect(escrow.connect(admin).adminResolveRefund(funded.dealId))
        .to.emit(escrow, "Refunded")
        .withArgs(funded.dealId);

      expect(await token.balanceOf(buyer.address)).to.equal(price);
      expect((await escrow.deals(funded.dealId)).status).to.equal(4n);
      expect(await token.balanceOf(escrow.target)).to.equal(0n);
    });
  });

  describe("terminal-state safety and existence", function () {
    it("released cannot transition further and no second payout is possible", async function () {
      const { seller, buyer, admin, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded.dealId,
        scheduledAt: funded.scheduledAt,
        durationMinutes: funded.durationMinutes,
        gracePeriodMinutes: funded.gracePeriodMinutes,
      });
      const completedAt = (await escrow.deals(funded.dealId)).completedAt;
      await time.setNextBlockTimestamp(completedAt + DISPUTE_WINDOW);
      await escrow.connect(buyer).confirmRelease(funded.dealId);

      await expect(escrow.connect(buyer).confirmRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );
      await expect(escrow.connect(buyer).openDispute(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );
      await expect(escrow.autoRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );
      await expect(escrow.connect(admin).adminResolveRefund(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );
    });

    it("refunded cannot transition further and no second refund is possible", async function () {
      const { seller, buyer, admin, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await escrow.connect(buyer).openDispute(funded.dealId);
      await escrow.connect(admin).adminResolveRefund(funded.dealId);

      await expect(escrow.connect(admin).adminResolveRefund(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );
      await expect(escrow.connect(buyer).openDispute(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );
      await expect(escrow.autoRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );
      await expect(escrow.connect(buyer).confirmRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );
    });

    it("deal existence checks use storage invariant and revert for missing deals", async function () {
      const { escrow, buyer, admin } = await deployFixture();

      await expect(escrow.markCompleted(999n)).to.be.revertedWithCustomError(escrow, "DealNotFound");
      await expect(escrow.connect(buyer).confirmRelease(999n)).to.be.revertedWithCustomError(escrow, "DealNotFound");
      await expect(escrow.connect(buyer).openDispute(999n)).to.be.revertedWithCustomError(escrow, "DealNotFound");
      await expect(escrow.autoRelease(999n)).to.be.revertedWithCustomError(escrow, "DealNotFound");
      await expect(escrow.connect(admin).adminResolveRelease(999n)).to.be.revertedWithCustomError(
        escrow,
        "DealNotFound"
      );
      await expect(escrow.connect(admin).adminResolveRefund(999n)).to.be.revertedWithCustomError(
        escrow,
        "DealNotFound"
      );
    });
  });

  describe("reentrancy and CEI", function () {
    // These same-deal tests validate CEI ordering; the cross-deal test below isolates the global nonReentrant guard.
    it("release path rejects reentry during seller transfer and still settles correctly", async function () {
      const { treasury, outsider, token, escrow } = await deployReentrantFixture();
      const Hook = await ethers.getContractFactory("ReentrancyHook");

      const buyer = ethers.Wallet.createRandom().address;
      const seller = outsider.address;

      await token.mint(buyer, MIN_PRICE);
      await ethers.provider.send("hardhat_impersonateAccount", [buyer]);
      const buyerSigner = await ethers.getSigner(buyer);
      await outsider.sendTransaction({ to: buyer, value: ethers.parseEther("1") });
      await token.connect(buyerSigner).approve(escrow.target, MIN_PRICE);

      const scheduledAt = BigInt(await time.latest()) + 3600n;
      await escrow.connect(buyerSigner).createAndFundDeal(
        ethers.keccak256(ethers.toUtf8Bytes("reentrant-release")),
        seller,
        buyer,
        MIN_PRICE,
        scheduledAt,
        30,
        0
      );

      await time.setNextBlockTimestamp(scheduledAt + 30n * 60n);
      await escrow.connect(outsider).markCompleted(1n);

      const hook = await Hook.deploy(escrow.target, 1n, true);
      await hook.waitForDeployment();
      await token.setHook(hook.target);
      await token.setReenterOnTransfer(true);

      const completedAt = (await escrow.deals(1n)).completedAt;
      await time.setNextBlockTimestamp(completedAt + DISPUTE_WINDOW + 1n);

      await expect(escrow.connect(outsider).autoRelease(1n)).to.not.be.reverted;

      expect(await hook.attempted()).to.equal(true);
      expect(await hook.reentrantCallSucceeded()).to.equal(false);
      expect((await escrow.deals(1n)).status).to.equal(3n);
      expect(await token.balanceOf(escrow.target)).to.equal(0n);
      expect(await token.balanceOf(seller)).to.equal(MIN_PRICE - feeFor(MIN_PRICE));
      expect(await token.balanceOf(treasury.address)).to.equal(feeFor(MIN_PRICE));

      await ethers.provider.send("hardhat_stopImpersonatingAccount", [buyer]);
    });

    it("refund path rejects reentry during buyer transfer and still preserves escrow balance", async function () {
      const { treasury, admin, outsider, token, escrow } = await deployReentrantFixture();
      const buyer = ethers.Wallet.createRandom().address;
      const seller = outsider.address;

      await token.mint(buyer, MIN_PRICE);
      await ethers.provider.send("hardhat_impersonateAccount", [buyer]);
      const buyerSigner = await ethers.getSigner(buyer);
      await outsider.sendTransaction({ to: buyer, value: ethers.parseEther("1") });
      await token.connect(buyerSigner).approve(escrow.target, MIN_PRICE);

      const scheduledAt = BigInt(await time.latest()) + 3600n;
      await escrow.connect(buyerSigner).createAndFundDeal(
        ethers.keccak256(ethers.toUtf8Bytes("reentrant-refund")),
        seller,
        buyer,
        MIN_PRICE,
        scheduledAt,
        30,
        0
      );

      await escrow.connect(buyerSigner).openDispute(1n);

      const Hook = await ethers.getContractFactory("ReentrancyHook");
      const hook = await Hook.deploy(escrow.target, 1n, false);
      await hook.waitForDeployment();
      await token.setHook(hook.target);
      await token.setReenterOnTransfer(true);

      await expect(escrow.connect(admin).adminResolveRefund(1n)).to.not.be.reverted;

      expect(await hook.attempted()).to.equal(true);
      expect(await hook.reentrantCallSucceeded()).to.equal(false);
      expect((await escrow.deals(1n)).status).to.equal(4n);
      expect(await token.balanceOf(escrow.target)).to.equal(0n);
      expect(await token.balanceOf(buyer)).to.equal(MIN_PRICE);
      expect(await token.balanceOf(treasury.address)).to.equal(0n);

      await ethers.provider.send("hardhat_stopImpersonatingAccount", [buyer]);
    });

    it("cross-deal autoRelease reentry is blocked by nonReentrant while the second deal remains otherwise releasable", async function () {
      const { treasury, outsider, token, escrow } = await deployReentrantFixture();
      const Hook = await ethers.getContractFactory("ReentrancyHook");

      const buyer = ethers.Wallet.createRandom().address;
      const seller = outsider.address;

      await token.mint(buyer, MIN_PRICE * 2n);
      await ethers.provider.send("hardhat_impersonateAccount", [buyer]);
      const buyerSigner = await ethers.getSigner(buyer);
      await outsider.sendTransaction({ to: buyer, value: ethers.parseEther("1") });
      await token.connect(buyerSigner).approve(escrow.target, MIN_PRICE * 2n);

      const now = BigInt(await time.latest());
      const firstScheduledAt = now + 3600n;
      const secondScheduledAt = now + 7200n;

      await escrow.connect(buyerSigner).createAndFundDeal(
        ethers.keccak256(ethers.toUtf8Bytes("cross-reentrant-a")),
        seller,
        buyer,
        MIN_PRICE,
        firstScheduledAt,
        30,
        0
      );

      await escrow.connect(buyerSigner).createAndFundDeal(
        ethers.keccak256(ethers.toUtf8Bytes("cross-reentrant-b")),
        seller,
        buyer,
        MIN_PRICE,
        secondScheduledAt,
        30,
        0
      );

      await time.setNextBlockTimestamp(firstScheduledAt + 30n * 60n);
      await escrow.connect(outsider).markCompleted(1n);

      await time.setNextBlockTimestamp(secondScheduledAt + 30n * 60n);
      await escrow.connect(outsider).markCompleted(2n);

      const firstCompletedAt = (await escrow.deals(1n)).completedAt;
      const secondCompletedAt = (await escrow.deals(2n)).completedAt;
      const releaseTime = secondCompletedAt + DISPUTE_WINDOW + 1n;
      expect(releaseTime).to.be.greaterThan(firstCompletedAt + DISPUTE_WINDOW);

      const hook = await Hook.deploy(escrow.target, 2n, true);
      await hook.waitForDeployment();
      await token.setHook(hook.target);
      await token.setReenterOnTransfer(true);

      await time.setNextBlockTimestamp(releaseTime);
      await expect(escrow.connect(outsider).autoRelease(1n)).to.not.be.reverted;

      expect(await hook.attempted()).to.equal(true);
      expect(await hook.reentrantCallSucceeded()).to.equal(false);
      expect((await escrow.deals(1n)).status).to.equal(3n);
      expect((await escrow.deals(2n)).status).to.equal(2n);

      await expect(escrow.connect(outsider).autoRelease(2n)).to.not.be.reverted;
      expect((await escrow.deals(2n)).status).to.equal(3n);
      expect(await token.balanceOf(escrow.target)).to.equal(0n);
      expect(await token.balanceOf(seller)).to.equal((MIN_PRICE - feeFor(MIN_PRICE)) * 2n);
      expect(await token.balanceOf(treasury.address)).to.equal(feeFor(MIN_PRICE) * 2n);

      await ethers.provider.send("hardhat_stopImpersonatingAccount", [buyer]);
    });
  });
});
