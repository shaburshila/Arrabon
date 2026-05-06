// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IEscrowForHook {
    function autoRelease(uint256 dealId) external;
    function adminResolveRefund(uint256 dealId) external;
    function withdrawPayout() external;
    function withdrawTreasuryFees() external;
}

contract ReentrancyHook {
    enum AttackType {
        AutoRelease,
        AdminResolveRefund,
        WithdrawPayout,
        WithdrawTreasuryFees
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

    function executePrimary() external {
        if (attackType == AttackType.WithdrawPayout) {
            escrow.withdrawPayout();
            return;
        }

        if (attackType == AttackType.WithdrawTreasuryFees) {
            escrow.withdrawTreasuryFees();
        }
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
            return;
        }

        if (attackType == AttackType.WithdrawPayout) {
            try escrow.withdrawPayout() {
                reentrantCallSucceeded = true;
            } catch {
                reentrantCallSucceeded = false;
            }
            return;
        }

        try escrow.withdrawTreasuryFees() {
            reentrantCallSucceeded = true;
        } catch {
            reentrantCallSucceeded = false;
        }
    }
}
