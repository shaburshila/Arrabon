// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IEscrowForHook {
    function autoRelease(uint256 dealId) external;
    function adminResolveRefund(uint256 dealId) external;
}

contract ReentrancyHook {
    enum AttackType {
        AutoRelease,
        AdminResolveRefund
    }

    IEscrowForHook public immutable escrow;
    uint256 public immutable dealId;
    AttackType public immutable attackType;
    bool public attempted;
    bool public reentrantCallSucceeded;

    constructor(address escrowAddress, uint256 targetDealId, AttackType targetAttackType) {
        escrow = IEscrowForHook(escrowAddress);
        dealId = targetDealId;
        attackType = targetAttackType;
    }

    function onTokenTransfer() external {
        if (attempted) {
            return;
        }

        attempted = true;

        if (attackType == AttackType.AutoRelease) {
            try escrow.autoRelease(dealId) {
                reentrantCallSucceeded = true;
            } catch {
                reentrantCallSucceeded = false;
            }
            return;
        }

        if (attackType == AttackType.AdminResolveRefund) {
            try escrow.adminResolveRefund(dealId) {
                reentrantCallSucceeded = true;
            } catch {
                reentrantCallSucceeded = false;
            }
        }
    }
}
