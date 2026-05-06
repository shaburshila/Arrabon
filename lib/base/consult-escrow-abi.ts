export const createAndFundDealFunctionAbi = {
  type: "function",
  name: "createAndFundDeal",
  stateMutability: "nonpayable",
  inputs: [
    { name: "link_hash", type: "bytes32" },
    { name: "seller", type: "address" },
    { name: "buyer", type: "address" },
    { name: "price", type: "uint256" },
    { name: "scheduled_at", type: "uint256" },
    { name: "duration_minutes", type: "uint256" },
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
