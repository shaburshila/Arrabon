// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ConsultEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant FEE_BPS = 200;
    uint256 public constant FEE_DENOMINATOR = 10_000;
    uint256 public constant MIN_PRICE = 10_000_000;
    uint256 public constant MAX_PRICE = 1_000_000_000;
    uint256 public constant DISPUTE_WINDOW = 48 hours;
    bytes32 public constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant FUNDING_AUTHORIZATION_TYPEHASH =
        keccak256(
            "FundingAuthorization(address buyer,address seller,bytes32 linkHash,uint256 price,uint256 scheduledAt,uint256 durationMinutes,uint256 deadline,bytes32 nonce)"
        );
    uint256 private constant SECP256K1N_HALF =
        0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    enum Status {
        None,
        Funded,
        ConfirmPending,
        Released,
        Refunded,
        Disputed
    }

    struct Deal {
        bytes32 linkHash;
        address seller;
        address buyer;
        uint256 price;
        uint256 feeAmount;
        uint256 scheduledAt;
        uint256 durationMinutes;
        uint256 completedAt;
        Status status;
    }

    error DealNotFound();
    error UnauthorizedCaller();
    error LinkHashAlreadyUsed();
    error InvalidPrice();
    error InvalidSchedule();
    error InvalidDuration();
    error InvalidStateTransition();
    error ConfirmDisputeWindowExpired();
    error AutoReleaseTooEarly();
    error CallerNotAdmin();
    error CallerNotOwner();
    error InvalidAddress();
    error EmptyAdminList();
    error AdminAlreadyExists();
    error AdminNotFound();
    error LastAdminRemovalForbidden();
    error FundingAuthorizationExpired();
    error FundingNonceAlreadyUsed();
    error InvalidFundingSignature();
    error DealPayoutBlocked();
    error NoPendingPayout();
    error NoPendingTreasuryFees();
    error CallerNotTreasury();

    event DealFunded(uint256 indexed dealId, bytes32 indexed link_hash, address seller, address buyer);
    event Completed(uint256 indexed dealId, uint256 completedAt);
    event Released(uint256 indexed dealId, uint256 releasedAt);
    event Disputed(uint256 indexed dealId);
    event Refunded(uint256 indexed dealId);
    event DealPayoutBlockUpdated(uint256 indexed dealId, bool blocked);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PayoutAccrued(address indexed seller, uint256 amount);
    event PayoutWithdrawn(address indexed seller, uint256 amount);
    event TreasuryFeesAccrued(address indexed treasury, uint256 amount);
    event TreasuryFeesWithdrawn(address indexed treasury, uint256 amount);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);

    IERC20 public immutable usdc;
    address public immutable fundingAuthorizer;
    bytes32 public immutable DOMAIN_SEPARATOR;
    address public owner;
    address public treasury;

    mapping(uint256 => Deal) public deals;
    mapping(uint256 => bool) public dealPayoutBlocked;
    mapping(bytes32 => bool) public usedLinkHashes;
    mapping(bytes32 => bool) public usedFundingNonces;
    mapping(address => bool) public admins;
    mapping(address => uint256) public pendingPayouts;
    uint256 public nextDealId;
    uint256 public adminCount;
    uint256 public pendingTreasuryFees;

    constructor(
        address usdcAddress,
        address treasuryAddress,
        address ownerAddress,
        address[] memory initialAdmins,
        address fundingAuthorizerAddress
    ) {
        if (
            usdcAddress == address(0)
                || treasuryAddress == address(0)
                || ownerAddress == address(0)
                || fundingAuthorizerAddress == address(0)
        ) {
            revert InvalidAddress();
        }
        if (initialAdmins.length == 0) {
            revert EmptyAdminList();
        }

        usdc = IERC20(usdcAddress);
        treasury = treasuryAddress;
        fundingAuthorizer = fundingAuthorizerAddress;
        owner = ownerAddress;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("ConsultEscrow")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
        nextDealId = 1;

        uint256 adminsLength = initialAdmins.length;
        for (uint256 i = 0; i < adminsLength; ++i) {
            address admin = initialAdmins[i];
            if (admin == address(0)) {
                revert InvalidAddress();
            }
            if (admins[admin]) {
                revert AdminAlreadyExists();
            }
            admins[admin] = true;
            adminCount += 1;
        }
    }

    function addAdmin(address admin) external {
        if (msg.sender != owner) {
            revert CallerNotOwner();
        }
        if (admin == address(0)) {
            revert InvalidAddress();
        }
        if (admins[admin]) {
            revert AdminAlreadyExists();
        }

        admins[admin] = true;
        adminCount += 1;

        emit AdminAdded(admin);
    }

    function removeAdmin(address admin) external {
        if (msg.sender != owner) {
            revert CallerNotOwner();
        }
        if (!admins[admin]) {
            revert AdminNotFound();
        }
        if (adminCount == 1) {
            revert LastAdminRemovalForbidden();
        }

        admins[admin] = false;
        adminCount -= 1;

        emit AdminRemoved(admin);
    }

    function transferOwnership(address newOwner) external {
        if (msg.sender != owner) {
            revert CallerNotOwner();
        }
        if (newOwner == address(0)) {
            revert InvalidAddress();
        }

        address previousOwner = owner;
        owner = newOwner;

        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function setTreasury(address newTreasury) external {
        if (msg.sender != owner) {
            revert CallerNotOwner();
        }
        if (newTreasury == address(0)) {
            revert InvalidAddress();
        }

        address previousTreasury = treasury;
        treasury = newTreasury;

        emit TreasuryUpdated(previousTreasury, newTreasury);
    }

    function createAndFundDeal(
        bytes32 link_hash,
        address seller,
        address buyer,
        uint256 price,
        uint256 scheduled_at,
        uint256 duration_minutes,
        uint256 deadline,
        bytes32 nonce,
        bytes calldata signature
    ) external nonReentrant {
        if (msg.sender != buyer) {
            revert UnauthorizedCaller();
        }
        if (seller == address(0) || buyer == address(0)) {
            revert InvalidAddress();
        }
        if (seller == buyer) {
            revert UnauthorizedCaller();
        }
        if (usedLinkHashes[link_hash]) {
            revert LinkHashAlreadyUsed();
        }
        if (price < MIN_PRICE || price > MAX_PRICE) {
            revert InvalidPrice();
        }
        if (scheduled_at <= block.timestamp) {
            revert InvalidSchedule();
        }
        if (duration_minutes == 0) {
            revert InvalidDuration();
        }
        if (deadline < block.timestamp) {
            revert FundingAuthorizationExpired();
        }
        if (usedFundingNonces[nonce]) {
            revert FundingNonceAlreadyUsed();
        }
        if (_recoverFundingAuthorizationSigner(buyer, seller, link_hash, price, scheduled_at, duration_minutes, deadline, nonce, signature) != fundingAuthorizer) {
            revert InvalidFundingSignature();
        }

        uint256 feeAmount = (price * FEE_BPS) / FEE_DENOMINATOR;
        uint256 dealId = nextDealId;
        nextDealId = dealId + 1;

        usedFundingNonces[nonce] = true;
        usedLinkHashes[link_hash] = true;
        deals[dealId] = Deal({
            linkHash: link_hash,
            seller: seller,
            buyer: buyer,
            price: price,
            feeAmount: feeAmount,
            scheduledAt: scheduled_at,
            durationMinutes: duration_minutes,
            completedAt: 0,
            status: Status.Funded
        });

        usdc.safeTransferFrom(buyer, address(this), price);

        emit DealFunded(dealId, link_hash, seller, buyer);
    }

    function markCompleted(uint256 dealId) external {
        Deal storage deal = _getDealOrRevert(dealId);

        if (msg.sender != deal.seller) {
            revert UnauthorizedCaller();
        }
        if (deal.status != Status.Funded) {
            revert InvalidStateTransition();
        }
        if (block.timestamp < deal.scheduledAt + (deal.durationMinutes * 60)) {
            revert InvalidStateTransition();
        }

        deal.completedAt = block.timestamp;
        deal.status = Status.ConfirmPending;

        emit Completed(dealId, deal.completedAt);
    }

    function confirmRelease(uint256 dealId) external nonReentrant {
        Deal storage deal = _getDealOrRevert(dealId);

        if (msg.sender != deal.buyer) {
            revert UnauthorizedCaller();
        }
        if (deal.status != Status.ConfirmPending) {
            revert InvalidStateTransition();
        }
        if (block.timestamp > _deadline(deal)) {
            revert ConfirmDisputeWindowExpired();
        }
        if (dealPayoutBlocked[dealId]) {
            revert DealPayoutBlocked();
        }

        _release(dealId, deal);
    }

    function openDispute(uint256 dealId) external {
        Deal storage deal = _getDealOrRevert(dealId);

        if (msg.sender != deal.buyer) {
            revert UnauthorizedCaller();
        }

        if (deal.status == Status.Funded) {
            deal.status = Status.Disputed;
            emit Disputed(dealId);
            return;
        }

        if (deal.status != Status.ConfirmPending) {
            revert InvalidStateTransition();
        }
        if (block.timestamp > _deadline(deal)) {
            revert ConfirmDisputeWindowExpired();
        }

        deal.status = Status.Disputed;
        emit Disputed(dealId);
    }

    function autoRelease(uint256 dealId) external nonReentrant {
        Deal storage deal = _getDealOrRevert(dealId);

        if (deal.status != Status.ConfirmPending) {
            revert InvalidStateTransition();
        }
        if (block.timestamp <= _deadline(deal)) {
            revert AutoReleaseTooEarly();
        }
        if (dealPayoutBlocked[dealId]) {
            revert DealPayoutBlocked();
        }

        _release(dealId, deal);
    }

    function setDealPayoutBlocked(uint256 dealId, bool blocked) external {
        Deal storage deal = _getDealOrRevert(dealId);

        if (!admins[msg.sender]) {
            revert CallerNotAdmin();
        }
        if (deal.status == Status.Released || deal.status == Status.Refunded) {
            revert InvalidStateTransition();
        }
        if (dealPayoutBlocked[dealId] == blocked) {
            return;
        }

        dealPayoutBlocked[dealId] = blocked;
        emit DealPayoutBlockUpdated(dealId, blocked);
    }

    function adminResolveRelease(uint256 dealId) external nonReentrant {
        Deal storage deal = _getDealOrRevert(dealId);

        if (!admins[msg.sender]) {
            revert CallerNotAdmin();
        }
        if (deal.status != Status.Disputed) {
            revert InvalidStateTransition();
        }

        _release(dealId, deal);
    }

    function adminResolveRefund(uint256 dealId) external nonReentrant {
        Deal storage deal = _getDealOrRevert(dealId);

        if (!admins[msg.sender]) {
            revert CallerNotAdmin();
        }
        if (deal.status != Status.Disputed) {
            revert InvalidStateTransition();
        }

        deal.status = Status.Refunded;
        usdc.safeTransfer(deal.buyer, deal.price);

        emit Refunded(dealId);
    }

    function withdrawPayout() external nonReentrant {
        uint256 amount = pendingPayouts[msg.sender];
        if (amount == 0) {
            revert NoPendingPayout();
        }

        pendingPayouts[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);

        emit PayoutWithdrawn(msg.sender, amount);
    }

    function withdrawTreasuryFees() external nonReentrant {
        if (msg.sender != treasury) {
            revert CallerNotTreasury();
        }

        uint256 amount = pendingTreasuryFees;
        if (amount == 0) {
            revert NoPendingTreasuryFees();
        }

        pendingTreasuryFees = 0;
        usdc.safeTransfer(msg.sender, amount);

        emit TreasuryFeesWithdrawn(msg.sender, amount);
    }

    function _getDealOrRevert(uint256 dealId) internal view returns (Deal storage deal) {
        deal = deals[dealId];
        if (deal.seller == address(0)) {
            revert DealNotFound();
        }
    }

    function _deadline(Deal storage deal) internal view returns (uint256) {
        return deal.completedAt + DISPUTE_WINDOW;
    }

    function _release(uint256 dealId, Deal storage deal) internal {
        uint256 sellerAmount = deal.price - deal.feeAmount;

        deal.status = Status.Released;
        pendingPayouts[deal.seller] += sellerAmount;
        pendingTreasuryFees += deal.feeAmount;

        emit Released(dealId, block.timestamp);
        emit PayoutAccrued(deal.seller, sellerAmount);
        emit TreasuryFeesAccrued(treasury, deal.feeAmount);
    }

    function _recoverFundingAuthorizationSigner(
        address buyer,
        address seller,
        bytes32 link_hash,
        uint256 price,
        uint256 scheduled_at,
        uint256 duration_minutes,
        uint256 deadline,
        bytes32 nonce,
        bytes calldata signature
    ) internal view returns (address) {
        if (signature.length != 65) {
            return address(0);
        }

        bytes32 structHash = keccak256(
            abi.encode(
                FUNDING_AUTHORIZATION_TYPEHASH,
                buyer,
                seller,
                link_hash,
                price,
                scheduled_at,
                duration_minutes,
                deadline,
                nonce
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly ("memory-safe") {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))
        }

        if (uint256(s) > SECP256K1N_HALF || (v != 27 && v != 28)) {
            return address(0);
        }

        return ecrecover(digest, v, r, s);
    }
}
