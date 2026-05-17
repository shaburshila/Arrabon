export const createAndFundDealFunctionAbi = {
  type: "function",
  name: "createAndFundDeal",
  stateMutability: "nonpayable",
  inputs: [
    { name: "consultation_link_id_hash", type: "bytes32" },
    { name: "link_hash", type: "bytes32" },
    { name: "seller", type: "address" },
    { name: "buyer", type: "address" },
    { name: "price", type: "uint256" },
    { name: "scheduled_at", type: "uint256" },
    { name: "duration_minutes", type: "uint256" },
    { name: "link_expires_at", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "nonce", type: "bytes32" },
    { name: "signature", type: "bytes" },
  ],
  outputs: [],
} as const;

export const markCompletedFunctionAbi = {
  type: "function",
  name: "markCompleted",
  stateMutability: "nonpayable",
  inputs: [{ name: "dealId", type: "uint256" }],
  outputs: [],
} as const;

export const confirmReleaseFunctionAbi = {
  type: "function",
  name: "confirmRelease",
  stateMutability: "nonpayable",
  inputs: [{ name: "dealId", type: "uint256" }],
  outputs: [],
} as const;

export const openDisputeFunctionAbi = {
  type: "function",
  name: "openDispute",
  stateMutability: "nonpayable",
  inputs: [{ name: "dealId", type: "uint256" }],
  outputs: [],
} as const;

export const autoReleaseFunctionAbi = {
  type: "function",
  name: "autoRelease",
  stateMutability: "nonpayable",
  inputs: [{ name: "dealId", type: "uint256" }],
  outputs: [],
} as const;

export const adminResolveReleaseFunctionAbi = {
  type: "function",
  name: "adminResolveRelease",
  stateMutability: "nonpayable",
  inputs: [{ name: "dealId", type: "uint256" }],
  outputs: [],
} as const;

export const adminResolveRefundFunctionAbi = {
  type: "function",
  name: "adminResolveRefund",
  stateMutability: "nonpayable",
  inputs: [{ name: "dealId", type: "uint256" }],
  outputs: [],
} as const;

export const setDealPayoutBlockedFunctionAbi = {
  type: "function",
  name: "setDealPayoutBlocked",
  stateMutability: "nonpayable",
  inputs: [
    { name: "dealId", type: "uint256" },
    { name: "blocked", type: "bool" },
  ],
  outputs: [],
} as const;

export const treasuryFunctionAbi = {
  type: "function",
  name: "treasury",
  stateMutability: "view",
  inputs: [],
  outputs: [{ name: "", type: "address" }],
} as const;

export const setTreasuryFunctionAbi = {
  type: "function",
  name: "setTreasury",
  stateMutability: "nonpayable",
  inputs: [{ name: "newTreasury", type: "address" }],
  outputs: [],
} as const;

export const ownerFunctionAbi = {
  type: "function",
  name: "owner",
  stateMutability: "view",
  inputs: [],
  outputs: [{ name: "", type: "address" }],
} as const;

export const adminCountFunctionAbi = {
  type: "function",
  name: "adminCount",
  stateMutability: "view",
  inputs: [],
  outputs: [{ name: "", type: "uint256" }],
} as const;

export const adminsFunctionAbi = {
  type: "function",
  name: "admins",
  stateMutability: "view",
  inputs: [{ name: "", type: "address" }],
  outputs: [{ name: "", type: "bool" }],
} as const;

export const addAdminFunctionAbi = {
  type: "function",
  name: "addAdmin",
  stateMutability: "nonpayable",
  inputs: [{ name: "admin", type: "address" }],
  outputs: [],
} as const;

export const removeAdminFunctionAbi = {
  type: "function",
  name: "removeAdmin",
  stateMutability: "nonpayable",
  inputs: [{ name: "admin", type: "address" }],
  outputs: [],
} as const;

export const transferOwnershipFunctionAbi = {
  type: "function",
  name: "transferOwnership",
  stateMutability: "nonpayable",
  inputs: [{ name: "newOwner", type: "address" }],
  outputs: [],
} as const;

export const adminAddedEventAbi = {
  type: "event",
  name: "AdminAdded",
  inputs: [{ indexed: true, name: "admin", type: "address" }],
  anonymous: false,
} as const;

export const adminRemovedEventAbi = {
  type: "event",
  name: "AdminRemoved",
  inputs: [{ indexed: true, name: "admin", type: "address" }],
  anonymous: false,
} as const;

export const ownershipTransferredEventAbi = {
  type: "event",
  name: "OwnershipTransferred",
  inputs: [
    { indexed: true, name: "previousOwner", type: "address" },
    { indexed: true, name: "newOwner", type: "address" },
  ],
  anonymous: false,
} as const;

export const treasuryUpdatedEventAbi = {
  type: "event",
  name: "TreasuryUpdated",
  inputs: [
    { indexed: true, name: "previousTreasury", type: "address" },
    { indexed: true, name: "newTreasury", type: "address" },
  ],
  anonymous: false,
} as const;
