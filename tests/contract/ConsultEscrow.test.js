const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ConsultEscrow", function () {
  const MIN_PRICE = 10_000_000n;
  const MAX_PRICE = 1_000_000_000n;
  const FEE_BPS = 200n;
  const FEE_DENOMINATOR = 10_000n;
  const DISPUTE_WINDOW = 48n * 60n * 60n;
  const FUNDING_AUTHORIZATION_LIFETIME = 180n;
  const FUNDING_AUTHORIZATION_TYPES = {
    FundingAuthorization: [
      { name: "buyer", type: "address" },
      { name: "seller", type: "address" },
      { name: "linkHash", type: "bytes32" },
      { name: "price", type: "uint256" },
      { name: "scheduledAt", type: "uint256" },
      { name: "durationMinutes", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  async function deployFixture() {
    const [deployer, seller, buyer, treasury, owner, admin, outsider, fundingAuthorizer] = await ethers.getSigners();
    const token = await ethers.deployContract("MockUSDC");
    const escrow = await ethers.deployContract("ConsultEscrow", [
      token.target,
      treasury.address,
      owner.address,
      [admin.address],
      fundingAuthorizer.address,
    ]);

    return { admin, authorizer: fundingAuthorizer, buyer, deployer, escrow, outsider, owner, seller, token, treasury };
  }

  async function deployReentrantFixture() {
    const [deployer, treasury, owner, admin, outsider] = await ethers.getSigners();
    const token = await ethers.deployContract("ReentrantToken");
    const escrow = await ethers.deployContract("ConsultEscrow", [
      token.target,
      treasury.address,
      owner.address,
      [admin.address],
      deployer.address,
    ]);

    return { admin, authorizer: deployer, deployer, escrow, outsider, owner, token, treasury };
  }

  function feeFor(price) {
    return (price * FEE_BPS) / FEE_DENOMINATOR;
  }

  async function signFundingAuthorization({
    escrow,
    authorizer,
    seller,
    buyer,
    price,
    linkHash,
    scheduledAt,
    durationMinutes,
    deadline,
    nonce,
  }) {
    const network = await ethers.provider.getNetwork();

    return authorizer.signTypedData(
      {
        name: "ConsultEscrow",
        version: "1",
        chainId: Number(network.chainId),
        verifyingContract: escrow.target,
      },
      FUNDING_AUTHORIZATION_TYPES,
      {
        buyer,
        seller,
        linkHash,
        price,
        scheduledAt,
        durationMinutes,
        deadline,
        nonce,
      }
    );
  }

  async function createAndFundDealAuthorized({
    escrow,
    authorizer,
    caller,
    seller,
    buyer,
    price,
    linkHash,
    scheduledAt,
    durationMinutes,
    deadline,
    nonce,
    signature,
  }) {
    const effectiveDeadline = deadline ?? (BigInt(await time.latest()) + FUNDING_AUTHORIZATION_LIFETIME);
    const effectiveNonce = nonce ?? ethers.hexlify(ethers.randomBytes(32));
    const effectiveSignature = signature ?? await signFundingAuthorization({
      escrow,
      authorizer,
      seller,
      buyer,
      price,
      linkHash,
      scheduledAt,
      durationMinutes,
      deadline: effectiveDeadline,
      nonce: effectiveNonce,
    });

    return escrow.connect(caller).createAndFundDeal(
      linkHash,
      seller,
      buyer,
      price,
      scheduledAt,
      durationMinutes,
      effectiveDeadline,
      effectiveNonce,
      effectiveSignature
    );
  }

  async function fundDeal({
    escrow,
    token,
    seller,
    buyer,
    authorizer,
    price = MIN_PRICE,
    linkHash = ethers.keccak256(ethers.toUtf8Bytes("link-1")),
    durationMinutes = 60n,
    scheduledAt,
  }) {
    const now = BigInt(await time.latest());
    const effectiveScheduledAt = scheduledAt ?? (now + 24n * 60n * 60n);
    const dealId = await escrow.nextDealId();
    let effectiveAuthorizer = authorizer;

    if (!effectiveAuthorizer) {
      const authorizerAddress = await escrow.fundingAuthorizer();
      const signers = await ethers.getSigners();
      effectiveAuthorizer = signers.find((signer) => signer.address === authorizerAddress);
    }

    await token.mint(buyer.address, price);
    await token.connect(buyer).approve(escrow.target, price);

    const tx = await createAndFundDealAuthorized({
      authorizer: effectiveAuthorizer,
      buyer: buyer.address,
      caller: buyer,
      durationMinutes,
      escrow,
      linkHash,
      price,
      scheduledAt: effectiveScheduledAt,
      seller: seller.address,
    });

    return {
      tx,
      dealId,
      linkHash,
      scheduledAt: effectiveScheduledAt,
      durationMinutes,
      price,
    };
  }

  async function markCompletedAtThreshold({
    escrow,
    seller,
    dealId = 1n,
    scheduledAt,
    durationMinutes = 60n,
  }) {
    const threshold = scheduledAt + durationMinutes * 60n;
    await time.setNextBlockTimestamp(threshold);
    const tx = await escrow.connect(seller).markCompleted(dealId);
    return { tx, threshold };
  }

  describe("constructor", function () {
    it("requires at least one admin", async function () {
      const [, , , treasury, owner] = await ethers.getSigners();
      const token = await ethers.deployContract("MockUSDC");
      const Escrow = await ethers.getContractFactory("ConsultEscrow");

      await expect(
        Escrow.deploy(token.target, treasury.address, owner.address, [], treasury.address)
      ).to.be.revertedWithCustomError(Escrow, "EmptyAdminList");
    });

    it("rejects duplicate initial admins", async function () {
      const [, , , treasury, owner, admin] = await ethers.getSigners();
      const token = await ethers.deployContract("MockUSDC");
      const Escrow = await ethers.getContractFactory("ConsultEscrow");

      await expect(
        Escrow.deploy(token.target, treasury.address, owner.address, [admin.address, admin.address], treasury.address)
      ).to.be.revertedWithCustomError(Escrow, "AdminAlreadyExists");
    });
  });

  describe("admin governance", function () {
    it("tracks owner and adminCount on deploy", async function () {
      const { admin, escrow, owner } = await deployFixture();

      expect(await escrow.owner()).to.equal(owner.address);
      expect(await escrow.admins(admin.address)).to.equal(true);
      expect(await escrow.adminCount()).to.equal(1n);
    });

    it("owner can add admin and outsider cannot", async function () {
      const { escrow, owner, outsider, seller } = await deployFixture();

      await expect(escrow.connect(outsider).addAdmin(seller.address)).to.be.revertedWithCustomError(
        escrow,
        "CallerNotOwner"
      );

      await expect(escrow.connect(owner).addAdmin(seller.address))
        .to.emit(escrow, "AdminAdded")
        .withArgs(seller.address);

      expect(await escrow.admins(seller.address)).to.equal(true);
      expect(await escrow.adminCount()).to.equal(2n);
    });

    it("existing admin cannot manage admin list without owner role", async function () {
      const { admin, escrow, seller } = await deployFixture();

      await expect(escrow.connect(admin).addAdmin(seller.address)).to.be.revertedWithCustomError(
        escrow,
        "CallerNotOwner"
      );
      await expect(escrow.connect(admin).removeAdmin(admin.address)).to.be.revertedWithCustomError(
        escrow,
        "CallerNotOwner"
      );
    });

    it("duplicate addAdmin reverts", async function () {
      const { admin, escrow, owner } = await deployFixture();

      await expect(escrow.connect(owner).addAdmin(admin.address)).to.be.revertedWithCustomError(
        escrow,
        "AdminAlreadyExists"
      );
    });

    it("removeAdmin for missing admin reverts", async function () {
      const { escrow, owner, seller } = await deployFixture();

      await expect(escrow.connect(owner).removeAdmin(seller.address)).to.be.revertedWithCustomError(
        escrow,
        "AdminNotFound"
      );
    });

    it("cannot remove last admin", async function () {
      const { admin, escrow, owner } = await deployFixture();

      await expect(escrow.connect(owner).removeAdmin(admin.address)).to.be.revertedWithCustomError(
        escrow,
        "LastAdminRemovalForbidden"
      );
    });

    it("owner can remove admin when another admin exists", async function () {
      const { admin, escrow, owner, seller } = await deployFixture();

      await escrow.connect(owner).addAdmin(seller.address);

      await expect(escrow.connect(owner).removeAdmin(admin.address))
        .to.emit(escrow, "AdminRemoved")
        .withArgs(admin.address);

      expect(await escrow.admins(admin.address)).to.equal(false);
      expect(await escrow.admins(seller.address)).to.equal(true);
      expect(await escrow.adminCount()).to.equal(1n);
    });

    it("removed admin loses admin-only access and added admin gains it", async function () {
      const { admin, buyer, escrow, owner, seller, token } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });

      await escrow.connect(buyer).openDispute(funded.dealId);
      await escrow.connect(owner).addAdmin(seller.address);
      await escrow.connect(owner).removeAdmin(admin.address);

      await expect(escrow.connect(admin).adminResolveRefund(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "CallerNotAdmin"
      );

      await expect(escrow.connect(seller).adminResolveRefund(funded.dealId)).to.not.be.reverted;
    });

    it("owner can transfer ownership", async function () {
      const { escrow, outsider, owner, seller } = await deployFixture();

      await expect(escrow.connect(owner).transferOwnership(outsider.address))
        .to.emit(escrow, "OwnershipTransferred")
        .withArgs(owner.address, outsider.address);

      expect(await escrow.owner()).to.equal(outsider.address);

      await expect(escrow.connect(owner).addAdmin(seller.address)).to.be.revertedWithCustomError(
        escrow,
        "CallerNotOwner"
      );

      await expect(escrow.connect(outsider).addAdmin(seller.address)).to.not.be.reverted;
    });
  });

  describe("funding", function () {
    it("valid funding succeeds", async function () {
      const { seller, buyer, token, escrow, authorizer } = await deployFixture();
      const price = 123_456_789n;
      const linkHash = ethers.keccak256(ethers.toUtf8Bytes("valid-funding"));
      const now = BigInt(await time.latest());
      const scheduledAt = now + 3600n;
      const effectiveNonce = ethers.hexlify(ethers.randomBytes(32));

      await token.mint(buyer.address, price);
      await token.connect(buyer).approve(escrow.target, price);

      await expect(
        createAndFundDealAuthorized({
          authorizer,
          buyer: buyer.address,
          caller: buyer,
          durationMinutes: 30n,
          escrow,
          linkHash,
          nonce: effectiveNonce,
          price,
          scheduledAt,
          seller: seller.address,
        })
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
      expect(deal.completedAt).to.equal(0n);
      expect(deal.status).to.equal(1n);
      expect(await escrow.usedLinkHashes(linkHash)).to.equal(true);
      expect(await escrow.usedFundingNonces(effectiveNonce)).to.equal(true);
      expect(await escrow.nextDealId()).to.equal(2n);
      expect(await token.balanceOf(escrow.target)).to.equal(price);
      expect(await token.balanceOf(await escrow.treasury())).to.equal(0n);
    });

    it("duplicate linkHash funding fails", async function () {
      const { seller, buyer, outsider, token, escrow, authorizer } = await deployFixture();
      const linkHash = ethers.keccak256(ethers.toUtf8Bytes("duplicate-link"));
      const now = BigInt(await time.latest());
      const scheduledAt = now + 3600n;

      await token.mint(buyer.address, MIN_PRICE);
      await token.connect(buyer).approve(escrow.target, MIN_PRICE);
      await createAndFundDealAuthorized({
        authorizer,
        buyer: buyer.address,
        caller: buyer,
        durationMinutes: 30n,
        escrow,
        linkHash,
        price: MIN_PRICE,
        scheduledAt,
        seller: seller.address,
      });

      await token.mint(outsider.address, MIN_PRICE);
      await token.connect(outsider).approve(escrow.target, MIN_PRICE);

      await expect(
        createAndFundDealAuthorized({
          authorizer,
          buyer: outsider.address,
          caller: outsider,
          durationMinutes: 30n,
          escrow,
          linkHash,
          price: MIN_PRICE,
          scheduledAt: scheduledAt + 100n,
          seller: seller.address,
        })
      ).to.be.revertedWithCustomError(escrow, "LinkHashAlreadyUsed");
    });

    it("buyer-only funding enforced", async function () {
      const { seller, buyer, outsider, token, escrow, authorizer } = await deployFixture();
      const now = BigInt(await time.latest());
      const scheduledAt = now + 3600n;

      await token.mint(buyer.address, MIN_PRICE);
      await token.connect(buyer).approve(escrow.target, MIN_PRICE);

      await expect(
        createAndFundDealAuthorized({
          authorizer,
          buyer: buyer.address,
          caller: outsider,
          durationMinutes: 30n,
          escrow,
          linkHash: ethers.keccak256(ethers.toUtf8Bytes("buyer-only")),
          price: MIN_PRICE,
          scheduledAt,
          seller: seller.address,
        })
      ).to.be.revertedWithCustomError(escrow, "UnauthorizedCaller");
    });

    it("seller cannot equal buyer", async function () {
      const { buyer, token, escrow, authorizer } = await deployFixture();
      const now = BigInt(await time.latest());
      const scheduledAt = now + 3600n;

      await token.mint(buyer.address, MIN_PRICE);
      await token.connect(buyer).approve(escrow.target, MIN_PRICE);

      await expect(
        createAndFundDealAuthorized({
          authorizer,
          buyer: buyer.address,
          caller: buyer,
          durationMinutes: 30n,
          escrow,
          linkHash: ethers.keccak256(ethers.toUtf8Bytes("same-party")),
          price: MIN_PRICE,
          scheduledAt,
          seller: buyer.address,
        })
      ).to.be.revertedWithCustomError(escrow, "UnauthorizedCaller");
    });

    it("price boundaries are enforced exactly", async function () {
      const { seller, buyer, token, escrow, authorizer } = await deployFixture();
      const now = BigInt(await time.latest());
      const scheduledAt = now + 3600n;

      for (const amount of [9_999_999n, 10_000_000n, 1_000_000_000n, 1_000_000_001n]) {
        await token.mint(buyer.address, amount);
      }
      await token.connect(buyer).approve(escrow.target, 9_999_999n + 10_000_000n + 1_000_000_000n + 1_000_000_001n);

      await expect(
        createAndFundDealAuthorized({
          authorizer,
          buyer: buyer.address,
          caller: buyer,
          durationMinutes: 30n,
          escrow,
          linkHash: ethers.keccak256(ethers.toUtf8Bytes("below-min")),
          price: 9_999_999n,
          scheduledAt,
          seller: seller.address,
        })
      ).to.be.revertedWithCustomError(escrow, "InvalidPrice");

      await expect(
        createAndFundDealAuthorized({
          authorizer,
          buyer: buyer.address,
          caller: buyer,
          durationMinutes: 30n,
          escrow,
          linkHash: ethers.keccak256(ethers.toUtf8Bytes("min-ok")),
          price: 10_000_000n,
          scheduledAt: scheduledAt + 1n,
          seller: seller.address,
        })
      ).to.not.be.reverted;

      await expect(
        createAndFundDealAuthorized({
          authorizer,
          buyer: buyer.address,
          caller: buyer,
          durationMinutes: 30n,
          escrow,
          linkHash: ethers.keccak256(ethers.toUtf8Bytes("max-ok")),
          price: 1_000_000_000n,
          scheduledAt: scheduledAt + 2n,
          seller: seller.address,
        })
      ).to.not.be.reverted;

      await expect(
        createAndFundDealAuthorized({
          authorizer,
          buyer: buyer.address,
          caller: buyer,
          durationMinutes: 30n,
          escrow,
          linkHash: ethers.keccak256(ethers.toUtf8Bytes("above-max")),
          price: 1_000_000_001n,
          scheduledAt: scheduledAt + 3n,
          seller: seller.address,
        })
      ).to.be.revertedWithCustomError(escrow, "InvalidPrice");
    });

    it("invalid schedule fails", async function () {
      const { seller, buyer, token, escrow, authorizer } = await deployFixture();
      const now = BigInt(await time.latest());

      await token.mint(buyer.address, MIN_PRICE);
      await token.connect(buyer).approve(escrow.target, MIN_PRICE);

      await expect(
        createAndFundDealAuthorized({
          authorizer,
          buyer: buyer.address,
          caller: buyer,
          durationMinutes: 30n,
          escrow,
          linkHash: ethers.keccak256(ethers.toUtf8Bytes("bad-schedule")),
          price: MIN_PRICE,
          scheduledAt: now,
          seller: seller.address,
        })
      ).to.be.revertedWithCustomError(escrow, "InvalidSchedule");
    });

    it("invalid duration fails", async function () {
      const { seller, buyer, token, escrow, authorizer } = await deployFixture();
      const now = BigInt(await time.latest());
      const scheduledAt = now + 3600n;

      await token.mint(buyer.address, MIN_PRICE);
      await token.connect(buyer).approve(escrow.target, MIN_PRICE);

      await expect(
        createAndFundDealAuthorized({
          authorizer,
          buyer: buyer.address,
          caller: buyer,
          durationMinutes: 0n,
          escrow,
          linkHash: ethers.keccak256(ethers.toUtf8Bytes("bad-duration")),
          price: MIN_PRICE,
          scheduledAt,
          seller: seller.address,
        })
      ).to.be.revertedWithCustomError(escrow, "InvalidDuration");
    });

    it("rejects expired funding authorization", async function () {
      const { seller, buyer, token, escrow, authorizer } = await deployFixture();
      const now = BigInt(await time.latest());
      const scheduledAt = now + 3600n;

      await token.mint(buyer.address, MIN_PRICE);
      await token.connect(buyer).approve(escrow.target, MIN_PRICE);

      await expect(
        createAndFundDealAuthorized({
          authorizer,
          buyer: buyer.address,
          caller: buyer,
          deadline: now - 1n,
          durationMinutes: 30n,
          escrow,
          linkHash: ethers.keccak256(ethers.toUtf8Bytes("expired-auth")),
          price: MIN_PRICE,
          scheduledAt,
          seller: seller.address,
        })
      ).to.be.revertedWithCustomError(escrow, "FundingAuthorizationExpired");
    });

    it("rejects reused funding nonce", async function () {
      const { seller, buyer, token, escrow, authorizer } = await deployFixture();
      const now = BigInt(await time.latest());
      const scheduledAt = now + 3600n;
      const nonce = ethers.hexlify(ethers.randomBytes(32));

      await token.mint(buyer.address, MIN_PRICE * 2n);
      await token.connect(buyer).approve(escrow.target, MIN_PRICE * 2n);

      await createAndFundDealAuthorized({
        authorizer,
        buyer: buyer.address,
        caller: buyer,
        durationMinutes: 30n,
        escrow,
        linkHash: ethers.keccak256(ethers.toUtf8Bytes("nonce-a")),
        nonce,
        price: MIN_PRICE,
        scheduledAt,
        seller: seller.address,
      });

      await expect(
        createAndFundDealAuthorized({
          authorizer,
          buyer: buyer.address,
          caller: buyer,
          durationMinutes: 30n,
          escrow,
          linkHash: ethers.keccak256(ethers.toUtf8Bytes("nonce-b")),
          nonce,
          price: MIN_PRICE,
          scheduledAt: scheduledAt + 1n,
          seller: seller.address,
        })
      ).to.be.revertedWithCustomError(escrow, "FundingNonceAlreadyUsed");
    });

    it("rejects invalid funding signature", async function () {
      const { seller, buyer, token, escrow, authorizer, outsider } = await deployFixture();
      const now = BigInt(await time.latest());
      const scheduledAt = now + 3600n;
      const linkHash = ethers.keccak256(ethers.toUtf8Bytes("bad-signature"));
      const deadline = now + FUNDING_AUTHORIZATION_LIFETIME;
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const signature = await signFundingAuthorization({
        authorizer: outsider,
        buyer: buyer.address,
        deadline,
        durationMinutes: 30n,
        escrow,
        linkHash,
        nonce,
        price: MIN_PRICE,
        scheduledAt,
        seller: seller.address,
      });

      await token.mint(buyer.address, MIN_PRICE);
      await token.connect(buyer).approve(escrow.target, MIN_PRICE);

      await expect(
        createAndFundDealAuthorized({
          authorizer,
          buyer: buyer.address,
          caller: buyer,
          deadline,
          durationMinutes: 30n,
          escrow,
          linkHash,
          nonce,
          price: MIN_PRICE,
          scheduledAt,
          seller: seller.address,
          signature,
        })
      ).to.be.revertedWithCustomError(escrow, "InvalidFundingSignature");
    });
  });

  describe("deal payout block", function () {
    it("only admin can update payout block state", async function () {
      const { seller, buyer, outsider, admin, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });

      await expect(
        escrow.connect(outsider).setDealPayoutBlocked(funded.dealId, true)
      ).to.be.revertedWithCustomError(escrow, "CallerNotAdmin");

      await expect(escrow.connect(admin).setDealPayoutBlocked(funded.dealId, true))
        .to.emit(escrow, "DealPayoutBlockUpdated")
        .withArgs(funded.dealId, true);
      expect(await escrow.dealPayoutBlocked(funded.dealId)).to.equal(true);
    });

    it("reverts when the deal does not exist", async function () {
      const { admin, escrow } = await deployFixture();

      await expect(
        escrow.connect(admin).setDealPayoutBlocked(999n, true)
      ).to.be.revertedWithCustomError(escrow, "DealNotFound");
    });

    it("treats repeated block state updates as a no-op", async function () {
      const { seller, buyer, admin, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });

      await escrow.connect(admin).setDealPayoutBlocked(funded.dealId, true);
      await expect(escrow.connect(admin).setDealPayoutBlocked(funded.dealId, true))
        .to.not.emit(escrow, "DealPayoutBlockUpdated");
      expect(await escrow.dealPayoutBlocked(funded.dealId)).to.equal(true);
    });

    it("rejects payout block updates for terminal deals", async function () {
      const { seller, buyer, admin, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await escrow.connect(buyer).openDispute(funded.dealId);
      await escrow.connect(admin).adminResolveRefund(funded.dealId);

      await expect(
        escrow.connect(admin).setDealPayoutBlocked(funded.dealId, true)
      ).to.be.revertedWithCustomError(escrow, "InvalidStateTransition");
    });
  });

  describe("markCompleted", function () {
    it("only seller can call", async function () {
      const { seller, buyer, outsider, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });

      await expect(escrow.connect(outsider).markCompleted(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "UnauthorizedCaller"
      );
    });

    it("seller can mark completed immediately after funding and completedAt starts buyer window", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });

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
      });

      const completedAt = (await escrow.deals(funded.dealId)).completedAt;
      await time.setNextBlockTimestamp(completedAt + DISPUTE_WINDOW + 1n);

      await expect(escrow.connect(buyer).confirmRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "ConfirmDisputeWindowExpired"
      );
    });

    it("reverts when payout is blocked", async function () {
      const { seller, buyer, admin, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await escrow.connect(seller).markCompleted(funded.dealId);
      await escrow.connect(admin).setDealPayoutBlocked(funded.dealId, true);

      await expect(escrow.connect(buyer).confirmRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "DealPayoutBlocked"
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

    it("reverts when payout is blocked", async function () {
      const { seller, buyer, admin, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded.dealId,
        scheduledAt: funded.scheduledAt,
        durationMinutes: funded.durationMinutes,
      });
      await escrow.connect(admin).setDealPayoutBlocked(funded.dealId, true);
      const completedAt = (await escrow.deals(funded.dealId)).completedAt;
      await time.setNextBlockTimestamp(completedAt + DISPUTE_WINDOW + 1n);

      await expect(escrow.autoRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "DealPayoutBlocked"
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

    it("admin resolve paths remain available when payout is blocked", async function () {
      const { seller, buyer, admin, treasury, token, escrow } = await deployFixture();
      const price = 100_000_000n;
      const fundedRelease = await fundDeal({
        escrow,
        token,
        seller,
        buyer,
        price,
        linkHash: ethers.keccak256(ethers.toUtf8Bytes("blocked-admin-release")),
      });
      await escrow.connect(buyer).openDispute(fundedRelease.dealId);
      await escrow.connect(admin).setDealPayoutBlocked(fundedRelease.dealId, true);

      await expect(escrow.connect(admin).adminResolveRelease(fundedRelease.dealId)).to.not.be.reverted;
      expect(await token.balanceOf(seller.address)).to.equal(price - feeFor(price));
      expect(await token.balanceOf(treasury.address)).to.equal(feeFor(price));

      const fundedRefund = await fundDeal({
        escrow,
        token,
        seller,
        buyer,
        price,
        linkHash: ethers.keccak256(ethers.toUtf8Bytes("blocked-admin-refund")),
      });
      await escrow.connect(buyer).openDispute(fundedRefund.dealId);
      await escrow.connect(admin).setDealPayoutBlocked(fundedRefund.dealId, true);

      await expect(escrow.connect(admin).adminResolveRefund(fundedRefund.dealId)).to.not.be.reverted;
      expect(await token.balanceOf(buyer.address)).to.equal(price);
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
      const { treasury, outsider, token, escrow, authorizer } = await deployReentrantFixture();
      const Hook = await ethers.getContractFactory("ReentrancyHook");

      const buyer = ethers.Wallet.createRandom().address;
      const seller = outsider.address;

      await token.mint(buyer, MIN_PRICE);
      await ethers.provider.send("hardhat_impersonateAccount", [buyer]);
      const buyerSigner = await ethers.getSigner(buyer);
      await outsider.sendTransaction({ to: buyer, value: ethers.parseEther("1") });
      await token.connect(buyerSigner).approve(escrow.target, MIN_PRICE);

      const scheduledAt = BigInt(await time.latest()) + 3600n;
      await createAndFundDealAuthorized({
        authorizer,
        buyer,
        caller: buyerSigner,
        durationMinutes: 30n,
        escrow,
        linkHash: ethers.keccak256(ethers.toUtf8Bytes("reentrant-release")),
        price: MIN_PRICE,
        scheduledAt,
        seller,
      });

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
      const { treasury, admin, outsider, token, escrow, authorizer } = await deployReentrantFixture();
      const buyer = ethers.Wallet.createRandom().address;
      const seller = outsider.address;

      await token.mint(buyer, MIN_PRICE);
      await ethers.provider.send("hardhat_impersonateAccount", [buyer]);
      const buyerSigner = await ethers.getSigner(buyer);
      await outsider.sendTransaction({ to: buyer, value: ethers.parseEther("1") });
      await token.connect(buyerSigner).approve(escrow.target, MIN_PRICE);

      const scheduledAt = BigInt(await time.latest()) + 3600n;
      await createAndFundDealAuthorized({
        authorizer,
        buyer,
        caller: buyerSigner,
        durationMinutes: 30n,
        escrow,
        linkHash: ethers.keccak256(ethers.toUtf8Bytes("reentrant-refund")),
        price: MIN_PRICE,
        scheduledAt,
        seller,
      });

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
      const { treasury, outsider, token, escrow, authorizer } = await deployReentrantFixture();
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

      await createAndFundDealAuthorized({
        authorizer,
        buyer,
        caller: buyerSigner,
        durationMinutes: 30n,
        escrow,
        linkHash: ethers.keccak256(ethers.toUtf8Bytes("cross-reentrant-a")),
        price: MIN_PRICE,
        scheduledAt: firstScheduledAt,
        seller,
      });

      await createAndFundDealAuthorized({
        authorizer,
        buyer,
        caller: buyerSigner,
        durationMinutes: 30n,
        escrow,
        linkHash: ethers.keccak256(ethers.toUtf8Bytes("cross-reentrant-b")),
        price: MIN_PRICE,
        scheduledAt: secondScheduledAt,
        seller,
      });

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
