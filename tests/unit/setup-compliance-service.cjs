'use strict';

const path = require('path');
const originalConsoleInfo = console.info;

function makeEntry(id, exports) {
  return {
    id,
    filename: id,
    loaded: true,
    exports,
    paths: [],
    parent: null,
    children: [],
  };
}

require.cache[require.resolve('server-only')] = makeEntry('server-only', {});

class ComplianceChecksRepositoryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ComplianceChecksRepositoryError';
    this.code = code;
  }
}

class DealsRepositoryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'DealsRepositoryError';
    this.code = code;
  }
}

const mocks = {
  provider: {
    id: 'composite',
    screenWallet: async () => ({
      normalizedWallet: '0x00000000000000000000000000000000000000aa',
      provider: null,
      rawSummary: { providerResults: [] },
      reasonCode: 'NO_HIT',
      result: 'Clear',
      walletAddress: '0x00000000000000000000000000000000000000AA',
    }),
  },
  createComplianceCheck: async (input) => ({
    id: 'check-id-1',
    actor_wallet: input.actorWallet,
    checked_at: input.checkedAt ?? '2026-04-27T00:00:00.000Z',
    deal_id: input.dealId,
    provider: input.provider,
    raw_summary: input.rawSummary ?? {},
    reason_code: input.reasonCode,
    result: input.result,
    subject_type: input.subjectType,
    subject_value: input.subjectValue,
  }),
  findBlockedByDeal: async () => [],
  findByDeal: async () => [],
  getById: async () => ({
    id: 'deal-id-1',
    consultation_link_id: 'link-id-1',
    onchain_deal_id: '1',
    buyer_address: '0xBuyer',
    seller_address: '0xSeller',
    status: 'Funded',
    risk_status: 'Clear',
    funded_at: null,
    completed_at: null,
    released_at: null,
    resolution_type: null,
    resolved_at: null,
    resolved_by_wallet: null,
    resolved_from_status: null,
    tx_hash: null,
    created_at: '2026-04-27T00:00:00.000Z',
  }),
  updateRiskStatusById: async (id, riskStatus) => ({
    id,
    consultation_link_id: 'link-id-1',
    onchain_deal_id: '1',
    buyer_address: '0xBuyer',
    seller_address: '0xSeller',
    status: 'Funded',
    risk_status: riskStatus,
    funded_at: null,
    completed_at: null,
    released_at: null,
    resolution_type: null,
    resolved_at: null,
    resolved_by_wallet: null,
    resolved_from_status: null,
    tx_hash: null,
    created_at: '2026-04-27T00:00:00.000Z',
  }),
  calls: {
    createComplianceCheck: [],
    getById: [],
    monitoringEvents: [],
    updateRiskStatusById: [],
  },
  reset() {
    this.provider = {
      id: 'composite',
      screenWallet: async () => ({
        normalizedWallet: '0x00000000000000000000000000000000000000aa',
        provider: null,
        rawSummary: { providerResults: [] },
        reasonCode: 'NO_HIT',
        result: 'Clear',
        walletAddress: '0x00000000000000000000000000000000000000AA',
      }),
    };
    this.createComplianceCheck = async (input) => ({
      id: 'check-id-1',
      actor_wallet: input.actorWallet,
      checked_at: input.checkedAt ?? '2026-04-27T00:00:00.000Z',
      deal_id: input.dealId,
      provider: input.provider,
      raw_summary: input.rawSummary ?? {},
      reason_code: input.reasonCode,
      result: input.result,
      subject_type: input.subjectType,
      subject_value: input.subjectValue,
    });
    this.findBlockedByDeal = async () => [];
    this.findByDeal = async () => [];
    this.getById = async () => ({
      id: 'deal-id-1',
      consultation_link_id: 'link-id-1',
      onchain_deal_id: '1',
      buyer_address: '0xBuyer',
      seller_address: '0xSeller',
      status: 'Funded',
      risk_status: 'Clear',
      funded_at: null,
      completed_at: null,
      released_at: null,
      resolution_type: null,
      resolved_at: null,
      resolved_by_wallet: null,
      resolved_from_status: null,
      tx_hash: null,
      created_at: '2026-04-27T00:00:00.000Z',
    });
    this.updateRiskStatusById = async (id, riskStatus) => ({
      id,
      consultation_link_id: 'link-id-1',
      onchain_deal_id: '1',
      buyer_address: '0xBuyer',
      seller_address: '0xSeller',
      status: 'Funded',
      risk_status: riskStatus,
      funded_at: null,
      completed_at: null,
      released_at: null,
      resolution_type: null,
      resolved_at: null,
      resolved_by_wallet: null,
      resolved_from_status: null,
      tx_hash: null,
      created_at: '2026-04-27T00:00:00.000Z',
    });
    this.calls = {
      createComplianceCheck: [],
      getById: [],
      monitoringEvents: [],
      updateRiskStatusById: [],
    };
  },
};

global.__complianceServiceMocks = mocks;

console.info = (message, payload, ...rest) => {
  if (message === 'compliance_check_duration' && payload && typeof payload === 'object') {
    mocks.calls.monitoringEvents.push(payload);
    return;
  }

  return originalConsoleInfo(message, payload, ...rest);
};

const root = path.resolve(__dirname, '../../');

const compositePath = path.resolve(root, 'lib/compliance/composite.ts');
require.cache[compositePath] = makeEntry(compositePath, {
  createCompositeComplianceProvider: () => mocks.provider,
});

const complianceChecksRepoPath = path.resolve(root, 'server/repositories/compliance-checks.ts');
require.cache[complianceChecksRepoPath] = makeEntry(complianceChecksRepoPath, {
  ComplianceChecksRepositoryError,
  createComplianceCheck: (...args) => {
    mocks.calls.createComplianceCheck.push(args[0]);
    return mocks.createComplianceCheck(...args);
  },
  findBlockedByDeal: (...args) => mocks.findBlockedByDeal(...args),
  findByDeal: (...args) => mocks.findByDeal(...args),
});

const dealsRepoPath = path.resolve(root, 'server/repositories/deals.ts');
require.cache[dealsRepoPath] = makeEntry(dealsRepoPath, {
  DealsRepositoryError,
  getById: (...args) => {
    mocks.calls.getById.push(args[0]);
    return mocks.getById(...args);
  },
  updateRiskStatusById: (...args) => {
    mocks.calls.updateRiskStatusById.push(args);
    return mocks.updateRiskStatusById(...args);
  },
});
