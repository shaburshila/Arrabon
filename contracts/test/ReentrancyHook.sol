// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IEscrowForHook {
    function autoRelease(uint256 dealId) external;
    function adminResolveRefund(uint256 dealId) external;
}

contract ReentrancyHook {
    IEscrowForHook public immutable escrow;
    uint256 public immutable dealId;
    bool public immutable attackRelease;
    bool public attempted;
    bool public reentrantCallSucceeded;

    constructor(address escrowAddress, uint256 targetDealId, bool targetRelease) {
        escrow = IEscrowForHook(escrowAddress);
        dealId = targetDealId;
        attackRelease = targetRelease;
    }

    function onTokenTransfer() external {
        if (attempted) {
            return;
        }

        attempted = true;

        if (attackRelease) {
            try escrow.autoRelease(dealId) {
                reentrantCallSucceeded = true;
            } catch {
                reentrantCallSucceeded = false;
            }
        } else {
            try escrow.adminResolveRefund(dealId) {
                reentrantCallSucceeded = true;
            } catch {
                reentrantCallSucceeded = false;
            }
        }
    }
}
