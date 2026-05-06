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
  const ATTACK_AUTO_RELEASE = 0;
  const ATTACK_ADMIN_RESOLVE_REFUND = 1;
  const ATTACK_WITHDRAW_PAYOUT = 2;
  const ATTACK_WITHDRAW_TREASURY_FEES = 3;
  const FUNDING_AUTHORIZATION_TYPES = {
    FundingAuthorization: [
      { name: "consultationLinkIdHash", type: "bytes32" },
      { name: "buyer", type: "address" },
      { name: "seller", type: "address" },
      { name: "linkHash", type: "bytes32" },
      { name: "price", type: "uint256" },
      { name: "scheduledAt", type: "uint256" },
      { name: "durationMinutes", type: "uint256" },
      { name: "linkExpiresAt", type: "uint256" },
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
    consultationLinkIdHash,
    linkExpiresAt,
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
        consultationLinkIdHash,
        buyer,
        seller,
        linkHash,
        price,
        scheduledAt,
        durationMinutes,
        linkExpiresAt,
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
    consultationLinkIdHash,
    linkExpiresAt,
    deadline,
    nonce,
    signature,
  }) {
    const effectiveDeadline = deadline ?? (BigInt(await time.latest()) + FUNDING_AUTHORIZATION_LIFETIME);
    const effectiveNonce = nonce ?? ethers.hexlify(ethers.randomBytes(32));
    const effectiveConsultationLinkIdHash =
      consultationLinkIdHash ?? ethers.keccak256(ethers.toUtf8Bytes("link-id-1"));
    const effectiveLinkExpiresAt = linkExpiresAt ?? (scheduledAt + 7n * 24n * 60n * 60n);
    const effectiveSignature = signature ?? await signFundingAuthorization({
      escrow,
      authorizer,
      seller,
      buyer,
      price,
      linkHash,
      scheduledAt,
      durationMinutes,
      consultationLinkIdHash: effectiveConsultationLinkIdHash,
      linkExpiresAt: effectiveLinkExpiresAt,
      deadline: effectiveDeadline,
      nonce: effectiveNonce,
    });

    return escrow.connect(caller).createAndFundDeal(
      effectiveConsultationLinkIdHash,
      linkHash,
      seller,
      buyer,
      price,
      scheduledAt,
      durationMinutes,
      effectiveLinkExpiresAt,
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
    consultationLinkIdHash = ethers.keccak256(ethers.toUtf8Bytes("link-id-1")),
    durationMinutes = 60n,
    scheduledAt,
    linkExpiresAt,
  }) {
    const now = BigInt(await time.latest());
    const effectiveScheduledAt = scheduledAt ?? (now + 24n * 60n * 60n);
    const effectiveLinkExpiresAt = linkExpiresAt ?? (effectiveScheduledAt + 7n * 24n * 60n * 60n);
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
      consultationLinkIdHash,
      durationMinutes,
      escrow,
      linkHash,
      linkExpiresAt: effectiveLinkExpiresAt,
      price,
      scheduledAt: effectiveScheduledAt,
      seller: seller.address,
    });

    return {
      tx,
      dealId,
      consultationLinkIdHash,
      linkExpiresAt: effectiveLinkExpiresAt,
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
    const threshold = scheduledAt;
    await time.setNextBlockTimestamp(threshold);
    const tx = await escrow.connect(seller).markCompleted(dealId);
    return { tx, threshold };
  }

  function releaseDeadlineFor(funded) {
    return funded.scheduledAt + funded.durationMinutes * 60n + DISPUTE_WINDOW;
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

    it("owner can rotate funding authorizer", async function () {
      const { escrow, owner, outsider, authorizer } = await deployFixture();

      await expect(escrow.connect(owner).setFundingAuthorizer(outsider.address))
        .to.emit(escrow, "FundingAuthorizerUpdated")
        .withArgs(authorizer.address, outsider.address);

      expect(await escrow.fundingAuthorizer()).to.equal(outsider.address);
    });

    it("non-owner cannot rotate funding authorizer", async function () {
      const { escrow, outsider, seller } = await deployFixture();

      await expect(escrow.connect(outsider).setFundingAuthorizer(seller.address)).to.be.revertedWithCustomError(
        escrow,
        "CallerNotOwner"
      );
    });

    it("setFundingAuthorizer rejects zero address", async function () {
      const { escrow, owner } = await deployFixture();

      await expect(escrow.connect(owner).setFundingAuthorizer(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        escrow,
        "InvalidAddress"
      );
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

    it("rejects expired link state when link expiry is already in the past", async function () {
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
          durationMinutes: 30n,
          escrow,
          linkExpiresAt: now,
          linkHash: ethers.keccak256(ethers.toUtf8Bytes("expired-link-state")),
          price: MIN_PRICE,
          scheduledAt,
          seller: seller.address,
        })
      ).to.be.revertedWithCustomError(escrow, "LinkExpired");
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
      const consultationLinkIdHash = ethers.keccak256(ethers.toUtf8Bytes("link-id-1"));
      const linkExpiresAt = scheduledAt + 7n * 24n * 60n * 60n;
      const deadline = now + FUNDING_AUTHORIZATION_LIFETIME;
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const signature = await signFundingAuthorization({
        authorizer: outsider,
        buyer: buyer.address,
        consultationLinkIdHash,
        deadline,
        durationMinutes: 30n,
        escrow,
        linkHash,
        linkExpiresAt,
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
          consultationLinkIdHash,
          deadline,
          durationMinutes: 30n,
          escrow,
          linkHash,
          linkExpiresAt,
          nonce,
          price: MIN_PRICE,
          scheduledAt,
          seller: seller.address,
          signature,
        })
      ).to.be.revertedWithCustomError(escrow, "InvalidFundingSignature");
    });

    it("rejects mismatched consultationLinkIdHash", async function () {
      const { seller, buyer, token, escrow, authorizer } = await deployFixture();
      const now = BigInt(await time.latest());
      const scheduledAt = now + 3600n;
      const linkHash = ethers.keccak256(ethers.toUtf8Bytes("bad-link-id-hash"));
      const deadline = now + FUNDING_AUTHORIZATION_LIFETIME;
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const signedConsultationLinkIdHash = ethers.keccak256(ethers.toUtf8Bytes("link-id-1"));
      const suppliedConsultationLinkIdHash = ethers.keccak256(ethers.toUtf8Bytes("link-id-2"));
      const linkExpiresAt = scheduledAt + 7n * 24n * 60n * 60n;
      const signature = await signFundingAuthorization({
        authorizer,
        buyer: buyer.address,
        consultationLinkIdHash: signedConsultationLinkIdHash,
        deadline,
        durationMinutes: 30n,
        escrow,
        linkHash,
        linkExpiresAt,
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
          consultationLinkIdHash: suppliedConsultationLinkIdHash,
          deadline,
          durationMinutes: 30n,
          escrow,
          linkHash,
          linkExpiresAt,
          nonce,
          price: MIN_PRICE,
          scheduledAt,
          seller: seller.address,
          signature,
        })
      ).to.be.revertedWithCustomError(escrow, "InvalidFundingSignature");
    });

    it("rejects old funding signatures after authorizer rotation", async function () {
      const { seller, buyer, token, escrow, authorizer, owner, outsider } = await deployFixture();
      const now = BigInt(await time.latest());
      const scheduledAt = now + 3600n;
      const linkHash = ethers.keccak256(ethers.toUtf8Bytes("old-authorizer-signature"));
      const consultationLinkIdHash = ethers.keccak256(ethers.toUtf8Bytes("link-id-rotation-old"));
      const linkExpiresAt = scheduledAt + 7n * 24n * 60n * 60n;
      const deadline = now + FUNDING_AUTHORIZATION_LIFETIME;
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const oldSignature = await signFundingAuthorization({
        authorizer,
        buyer: buyer.address,
        consultationLinkIdHash,
        deadline,
        durationMinutes: 30n,
        escrow,
        linkHash,
        linkExpiresAt,
        nonce,
        price: MIN_PRICE,
        scheduledAt,
        seller: seller.address,
      });

      await escrow.connect(owner).setFundingAuthorizer(outsider.address);
      await token.mint(buyer.address, MIN_PRICE);
      await token.connect(buyer).approve(escrow.target, MIN_PRICE);

      await expect(
        createAndFundDealAuthorized({
          authorizer,
          buyer: buyer.address,
          caller: buyer,
          consultationLinkIdHash,
          deadline,
          durationMinutes: 30n,
          escrow,
          linkHash,
          linkExpiresAt,
          nonce,
          price: MIN_PRICE,
          scheduledAt,
          seller: seller.address,
          signature: oldSignature,
        })
      ).to.be.revertedWithCustomError(escrow, "InvalidFundingSignature");
    });

    it("accepts new funding signatures after authorizer rotation", async function () {
      const { seller, buyer, token, escrow, owner, outsider } = await deployFixture();
      const now = BigInt(await time.latest());
      const scheduledAt = now + 3600n;

      await escrow.connect(owner).setFundingAuthorizer(outsider.address);
      await token.mint(buyer.address, MIN_PRICE);
      await token.connect(buyer).approve(escrow.target, MIN_PRICE);

      await expect(
        createAndFundDealAuthorized({
          authorizer: outsider,
          buyer: buyer.address,
          caller: buyer,
          durationMinutes: 30n,
          escrow,
          linkHash: ethers.keccak256(ethers.toUtf8Bytes("new-authorizer-signature")),
          price: MIN_PRICE,
          scheduledAt,
          seller: seller.address,
        })
      )
        .to.emit(escrow, "DealFunded")
        .withArgs(1n, ethers.keccak256(ethers.toUtf8Bytes("new-authorizer-signature")), seller.address, buyer.address);
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

    it("seller cannot mark completed before the consultation slot starts", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      const threshold = funded.scheduledAt;

      await time.setNextBlockTimestamp(threshold - 1n);

      await expect(escrow.connect(seller).markCompleted(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );
    });

    it("seller can mark completed at the start of the consultation slot and completedAt is recorded", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      const { tx, threshold } = await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded.dealId,
        scheduledAt: funded.scheduledAt,
        durationMinutes: funded.durationMinutes,
      });
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx).to.emit(escrow, "Completed").withArgs(funded.dealId, block.timestamp);

      const deal = await escrow.deals(funded.dealId);
      expect(deal.completedAt).to.equal(block.timestamp);
      expect(deal.completedAt).to.equal(threshold);
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

    it("allowed at exact deadline, accrues seller net and treasury fee, and emits exact timestamp", async function () {
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

      const deadline = releaseDeadlineFor(funded);
      const fee = feeFor(price);
      const sellerNet = price - fee;

      await time.setNextBlockTimestamp(deadline);

      const tx = await escrow.connect(buyer).confirmRelease(funded.dealId);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx).to.emit(escrow, "Released").withArgs(funded.dealId, block.timestamp);

      const deal = await escrow.deals(funded.dealId);
      expect(deal.status).to.equal(3n);
      expect(await escrow.pendingPayouts(seller.address)).to.equal(sellerNet);
      expect(await escrow.pendingTreasuryFees()).to.equal(fee);
      expect(await token.balanceOf(seller.address)).to.equal(0n);
      expect(await token.balanceOf(treasury.address)).to.equal(0n);
      expect(await token.balanceOf(escrow.target)).to.equal(price);
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

      const deadline = releaseDeadlineFor(funded);
      await time.setNextBlockTimestamp(deadline + 1n);

      await expect(escrow.connect(buyer).confirmRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "ConfirmDisputeWindowExpired"
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

      const deadline = releaseDeadlineFor(funded);
      await time.setNextBlockTimestamp(deadline);

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

      const deadline = releaseDeadlineFor(funded);
      await time.setNextBlockTimestamp(deadline + 1n);

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
      const deadline = releaseDeadlineFor(funded2);
      await time.setNextBlockTimestamp(deadline);
      await escrow.connect(buyer).confirmRelease(funded2.dealId);

      await expect(escrow.connect(buyer).openDispute(funded2.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );

      expect(await escrow.pendingTreasuryFees()).to.be.greaterThan(0n);
    });
  });

  describe("autoRelease", function () {
    it("reverts for non-seller callers", async function () {
      const { seller, buyer, admin, outsider, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded.dealId,
        scheduledAt: funded.scheduledAt,
        durationMinutes: funded.durationMinutes,
      });

      await expect(escrow.connect(buyer).autoRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "UnauthorizedCaller"
      );

      await expect(escrow.connect(admin).autoRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "UnauthorizedCaller"
      );

      await expect(escrow.connect(outsider).autoRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "UnauthorizedCaller"
      );
    });

    it("reverts when status is Funded", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });

      await expect(escrow.connect(seller).autoRelease(funded.dealId)).to.be.revertedWithCustomError(
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
      const deadline = releaseDeadlineFor(funded);
      await time.setNextBlockTimestamp(deadline);

      await expect(escrow.connect(seller).autoRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "AutoReleaseTooEarly"
      );
    });

    it("succeeds for seller only after deadline and accrues seller net plus treasury fee", async function () {
      const { seller, buyer, treasury, token, escrow } = await deployFixture();
      const price = 300_000_000n;
      const funded = await fundDeal({ escrow, token, seller, buyer, price });
      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded.dealId,
        scheduledAt: funded.scheduledAt,
        durationMinutes: funded.durationMinutes,
      });
      const deadline = releaseDeadlineFor(funded);
      await time.setNextBlockTimestamp(deadline + 1n);

      const tx = await escrow.connect(seller).autoRelease(funded.dealId);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx).to.emit(escrow, "Released").withArgs(funded.dealId, block.timestamp);

      const fee = feeFor(price);
      expect(await escrow.pendingPayouts(seller.address)).to.equal(price - fee);
      expect(await escrow.pendingTreasuryFees()).to.equal(fee);
      expect(await token.balanceOf(seller.address)).to.equal(0n);
      expect(await token.balanceOf(treasury.address)).to.equal(0n);
      expect((await escrow.deals(funded.dealId)).status).to.equal(3n);
    });

    it("is blocked if deal already disputed", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      await escrow.connect(buyer).openDispute(funded.dealId);

      await expect(escrow.connect(seller).autoRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );
    });

    it("late markCompleted: seller marks after deadline, autoRelease succeeds immediately — intended behavior", async function () {
      // Documented design decision (state-machine.md §4 "Late markCompleted"):
      // While in Funded state buyer had unlimited time to openDispute.
      // If buyer chose not to dispute, seller may call markCompleted at any point after scheduledAt.
      // If called after the fixed deadline, autoRelease is available immediately —
      // buyer's silence during Funded is treated as acceptance.
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      const deadline = releaseDeadlineFor(funded);

      // Seller calls markCompleted one hour after the deadline
      await time.setNextBlockTimestamp(deadline + 3600n);
      await escrow.connect(seller).markCompleted(funded.dealId);

      // autoRelease succeeds immediately — no additional wait needed
      await escrow.connect(seller).autoRelease(funded.dealId);

      expect((await escrow.deals(funded.dealId)).status).to.equal(3n); // Released
    });

    it("late markCompleted: buyer who opens dispute from Funded blocks seller autoRelease path", async function () {
      // Counterpart to the above: if buyer did use their Funded-state dispute right,
      // seller cannot reach autoRelease regardless of timing.
      const { seller, buyer, token, escrow } = await deployFixture();
      const funded = await fundDeal({ escrow, token, seller, buyer });
      const deadline = releaseDeadlineFor(funded);

      await time.setNextBlockTimestamp(deadline + 3600n);
      await escrow.connect(buyer).openDispute(funded.dealId);

      await expect(escrow.connect(seller).markCompleted(funded.dealId)).to.be.revertedWithCustomError(
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
      const deadline = releaseDeadlineFor(funded);
      await time.setNextBlockTimestamp(deadline + 1n);

      await expect(escrow.connect(seller).autoRelease(funded.dealId)).to.be.revertedWithCustomError(
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

    it("adminResolveRelease only from Disputed and accrues net to seller plus fee to treasury", async function () {
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
      expect(await escrow.pendingPayouts(seller.address)).to.equal(price - fee);
      expect(await escrow.pendingTreasuryFees()).to.equal(fee);
      expect(await token.balanceOf(seller.address)).to.equal(0n);
      expect(await token.balanceOf(treasury.address)).to.equal(0n);
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
      expect(await escrow.pendingPayouts(seller.address)).to.equal(price - feeFor(price));
      expect(await escrow.pendingTreasuryFees()).to.equal(feeFor(price));
      expect(await token.balanceOf(seller.address)).to.equal(0n);
      expect(await token.balanceOf(treasury.address)).to.equal(0n);

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

  describe("pull payments and treasury rotation", function () {
    it("seller can withdraw pending payout once after release accrual", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const price = 210_000_000n;
      const fee = feeFor(price);
      const funded = await fundDeal({ escrow, token, seller, buyer, price });
      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded.dealId,
        scheduledAt: funded.scheduledAt,
        durationMinutes: funded.durationMinutes,
      });
      const deadline = releaseDeadlineFor(funded);
      await time.setNextBlockTimestamp(deadline);
      await escrow.connect(buyer).confirmRelease(funded.dealId);

      await expect(escrow.connect(seller).withdrawPayout())
        .to.emit(escrow, "PayoutWithdrawn")
        .withArgs(seller.address, price - fee);

      expect(await escrow.pendingPayouts(seller.address)).to.equal(0n);
      expect(await token.balanceOf(seller.address)).to.equal(price - fee);
      expect(await token.balanceOf(escrow.target)).to.equal(fee);
    });

    it("seller payout accrual aggregates across multiple releases", async function () {
      const { seller, buyer, token, escrow } = await deployFixture();
      const firstPrice = 120_000_000n;
      const secondPrice = 140_000_000n;
      const first = await fundDeal({
        escrow,
        token,
        seller,
        buyer,
        price: firstPrice,
        linkHash: ethers.keccak256(ethers.toUtf8Bytes("aggregate-first")),
      });
      const second = await fundDeal({
        escrow,
        token,
        seller,
        buyer,
        price: secondPrice,
        linkHash: ethers.keccak256(ethers.toUtf8Bytes("aggregate-second")),
        scheduledAt: first.scheduledAt + 200_000n,
      });

      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: first.dealId,
        scheduledAt: first.scheduledAt,
        durationMinutes: first.durationMinutes,
      });
      await time.setNextBlockTimestamp(releaseDeadlineFor(first));
      await escrow.connect(buyer).confirmRelease(first.dealId);

      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: second.dealId,
        scheduledAt: second.scheduledAt,
        durationMinutes: second.durationMinutes,
      });
      await time.setNextBlockTimestamp(releaseDeadlineFor(second));
      await escrow.connect(buyer).confirmRelease(second.dealId);

      expect(await escrow.pendingPayouts(seller.address)).to.equal(
        (firstPrice - feeFor(firstPrice)) + (secondPrice - feeFor(secondPrice))
      );
    });

    it("withdrawPayout reverts when seller has no pending payout", async function () {
      const { seller, escrow } = await deployFixture();

      await expect(escrow.connect(seller).withdrawPayout()).to.be.revertedWithCustomError(
        escrow,
        "NoPendingPayout"
      );
    });

    it("treasury can withdraw pending fees and outsider cannot", async function () {
      const { seller, buyer, treasury, outsider, token, escrow } = await deployFixture();
      const price = 180_000_000n;
      const fee = feeFor(price);
      const funded = await fundDeal({ escrow, token, seller, buyer, price });
      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded.dealId,
        scheduledAt: funded.scheduledAt,
        durationMinutes: funded.durationMinutes,
      });
      await time.setNextBlockTimestamp(releaseDeadlineFor(funded));
      await escrow.connect(buyer).confirmRelease(funded.dealId);

      await expect(escrow.connect(outsider).withdrawTreasuryFees()).to.be.revertedWithCustomError(
        escrow,
        "CallerNotTreasury"
      );

      await expect(escrow.connect(treasury).withdrawTreasuryFees())
        .to.emit(escrow, "TreasuryFeesWithdrawn")
        .withArgs(treasury.address, fee);

      expect(await escrow.pendingTreasuryFees()).to.equal(0n);
      expect(await token.balanceOf(treasury.address)).to.equal(fee);
    });

    it("withdrawTreasuryFees reverts when no fees are pending", async function () {
      const { treasury, escrow } = await deployFixture();

      await expect(escrow.connect(treasury).withdrawTreasuryFees()).to.be.revertedWithCustomError(
        escrow,
        "NoPendingTreasuryFees"
      );
    });

    it("owner can rotate treasury and new treasury can withdraw accumulated fees", async function () {
      const { seller, buyer, treasury, owner, outsider, token, escrow } = await deployFixture();
      const price = 190_000_000n;
      const fee = feeFor(price);
      const funded = await fundDeal({ escrow, token, seller, buyer, price });
      await markCompletedAtThreshold({
        escrow,
        seller,
        dealId: funded.dealId,
        scheduledAt: funded.scheduledAt,
        durationMinutes: funded.durationMinutes,
      });
      await time.setNextBlockTimestamp(releaseDeadlineFor(funded));
      await escrow.connect(buyer).confirmRelease(funded.dealId);

      await expect(escrow.connect(owner).setTreasury(outsider.address))
        .to.emit(escrow, "TreasuryUpdated")
        .withArgs(treasury.address, outsider.address);

      expect(await escrow.treasury()).to.equal(outsider.address);

      await expect(escrow.connect(treasury).withdrawTreasuryFees()).to.be.revertedWithCustomError(
        escrow,
        "CallerNotTreasury"
      );

      await expect(escrow.connect(outsider).withdrawTreasuryFees())
        .to.emit(escrow, "TreasuryFeesWithdrawn")
        .withArgs(outsider.address, fee);
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
      await time.setNextBlockTimestamp(releaseDeadlineFor(funded));
      await escrow.connect(buyer).confirmRelease(funded.dealId);

      await expect(escrow.connect(buyer).confirmRelease(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );
      await expect(escrow.connect(buyer).openDispute(funded.dealId)).to.be.revertedWithCustomError(
        escrow,
        "InvalidStateTransition"
      );
      await expect(escrow.connect(seller).autoRelease(funded.dealId)).to.be.revertedWithCustomError(
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
      await expect(escrow.connect(seller).autoRelease(funded.dealId)).to.be.revertedWithCustomError(
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
    it("withdrawPayout rejects reentry and clears seller balance only once", async function () {
      const { admin, outsider, token, escrow, authorizer } = await deployReentrantFixture();
      const Hook = await ethers.getContractFactory("ReentrancyHook");
      const buyer = ethers.Wallet.createRandom().address;
      const hook = await Hook.deploy(escrow.target, 1n, ATTACK_WITHDRAW_PAYOUT);
      await hook.waitForDeployment();

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
        linkHash: ethers.keccak256(ethers.toUtf8Bytes("reentrant-withdraw-payout")),
        price: MIN_PRICE,
        scheduledAt,
        seller: hook.target,
      });

      await escrow.connect(buyerSigner).openDispute(1n);
      await escrow.connect(admin).adminResolveRelease(1n);

      await token.setHook(hook.target);
      await token.setReenterOnTransfer(true);

      await expect(hook.executePrimary()).to.not.be.reverted;

      expect(await hook.attempted()).to.equal(true);
      expect(await hook.reentrantCallSucceeded()).to.equal(false);
      expect(await escrow.pendingPayouts(hook.target)).to.equal(0n);
      expect(await token.balanceOf(hook.target)).to.equal(MIN_PRICE - feeFor(MIN_PRICE));
      expect(await token.balanceOf(escrow.target)).to.equal(feeFor(MIN_PRICE));
      expect(await escrow.pendingTreasuryFees()).to.equal(feeFor(MIN_PRICE));

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
      const hook = await Hook.deploy(escrow.target, 1n, ATTACK_ADMIN_RESOLVE_REFUND);
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

    it("withdrawTreasuryFees rejects reentry and clears treasury fees only once", async function () {
      const { outsider, owner, token, escrow, authorizer } = await deployReentrantFixture();
      const Hook = await ethers.getContractFactory("ReentrancyHook");
      const buyer = ethers.Wallet.createRandom().address;
      const seller = outsider.address;
      const hook = await Hook.deploy(escrow.target, 1n, ATTACK_WITHDRAW_TREASURY_FEES);
      await hook.waitForDeployment();

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
        linkHash: ethers.keccak256(ethers.toUtf8Bytes("reentrant-treasury-withdraw")),
        price: MIN_PRICE,
        scheduledAt,
        seller,
      });

      await time.setNextBlockTimestamp(scheduledAt + 30n * 60n);
      await escrow.connect(outsider).markCompleted(1n);
      await time.setNextBlockTimestamp(
        releaseDeadlineFor({ scheduledAt, durationMinutes: 30n }) + 1n
      );
      await escrow.connect(outsider).autoRelease(1n);

      await token.setHook(hook.target);
      await token.setReenterOnTransfer(true);
      await escrow.connect(owner).setTreasury(hook.target);

      await expect(hook.executePrimary()).to.not.be.reverted;

      expect(await hook.attempted()).to.equal(true);
      expect(await hook.reentrantCallSucceeded()).to.equal(false);
      expect(await escrow.pendingTreasuryFees()).to.equal(0n);
      expect(await token.balanceOf(hook.target)).to.equal(feeFor(MIN_PRICE));
      expect(await token.balanceOf(escrow.target)).to.equal(MIN_PRICE - feeFor(MIN_PRICE));

      await ethers.provider.send("hardhat_stopImpersonatingAccount", [buyer]);
    });

    it("release path no longer performs token transfers and leaves pull balances pending", async function () {
      const { admin, outsider, token, escrow, authorizer } = await deployReentrantFixture();
      const Hook = await ethers.getContractFactory("ReentrancyHook");
      const buyer = ethers.Wallet.createRandom().address;
      const hook = await Hook.deploy(escrow.target, 1n, ATTACK_AUTO_RELEASE);
      await hook.waitForDeployment();

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
        linkHash: ethers.keccak256(ethers.toUtf8Bytes("release-no-transfer-hook")),
        price: MIN_PRICE,
        scheduledAt,
        seller: hook.target,
      });

      await escrow.connect(buyerSigner).openDispute(1n);
      await token.setHook(hook.target);
      await token.setReenterOnTransfer(true);
      await expect(escrow.connect(admin).adminResolveRelease(1n)).to.not.be.reverted;

      expect(await hook.attempted()).to.equal(false);
      expect(await token.balanceOf(hook.target)).to.equal(0n);
      expect(await escrow.pendingPayouts(hook.target)).to.equal(MIN_PRICE - feeFor(MIN_PRICE));
      expect(await escrow.pendingTreasuryFees()).to.equal(feeFor(MIN_PRICE));

      await ethers.provider.send("hardhat_stopImpersonatingAccount", [buyer]);
    });
  });
});
