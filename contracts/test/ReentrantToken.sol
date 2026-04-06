// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IReentrancyHook {
    function onTokenTransfer() external;
}

contract ReentrantToken is ERC20 {
    address public hook;
    bool public reenterOnTransfer;
    bool public swallowHookRevert = true;

    constructor() ERC20("Reentrant Token", "RUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function setHook(address newHook) external {
        hook = newHook;
    }

    function setReenterOnTransfer(bool enabled) external {
        reenterOnTransfer = enabled;
    }

    function setSwallowHookRevert(bool enabled) external {
        swallowHookRevert = enabled;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);

        if (reenterOnTransfer && from != address(0) && to != address(0) && hook != address(0)) {
            if (swallowHookRevert) {
                try IReentrancyHook(hook).onTokenTransfer() {} catch {}
            } else {
                IReentrancyHook(hook).onTokenTransfer();
            }
        }
    }
}
