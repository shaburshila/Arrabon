'use strict';

const path = require('path');

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

class ConsultationLinksRepositoryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ConsultationLinksRepositoryError';
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

class ConsultEscrowConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConsultEscrowConfigError';
  }
}

class ComplianceBlockedError extends Error {
  constructor(input) {
    super('Compliance blocked');
    this.name = 'ComplianceBlockedError';
    this.dealId = input.dealId;
    this.provider = input.provider;
    this.reasonCode = input.reasonCode;
    this.walletAddress = input.walletAddress;
  }
}

const mocks = {
  assertCompliance: (...args) => undefined,
  createFundingExecutionGrant: async () => ({
    id: 'grant-id-1',
  }),
  consumeFundingExecutionGrant: async () => ({
    consultation_link_id: 'link-id-1',
    created_at: '2030-04-27T00:00:00.000Z',
    expires_at: '2030-04-27T00:05:00.000Z',
    id: 'grant-id-1',
    issued_by_wallet: '0x00000000000000000000000000000000000000AA',
    issued_to_wallet: '0x00000000000000000000000000000000000000AA',
    token_hash: 'hash-1',
    used_at: '2030-04-27T00:03:00.000Z',
  }),
  getByConsultationLinkId: async () => null,
  getById: async () => null,
  prepareCreateAndFundDealCall: (input) => ({
    chain_id: 84532,
    contract_address: '0x0000000000000000000000000000000000000001',
    data: '0x' + '1'.repeat(64),
    function_name: 'createAndFundDeal',
  }),
  createFundingAuthorizationNonce: () => '0x' + '2'.repeat(64),
  signFundingAuthorization: async () => '0x' + '3'.repeat(130),
  screenWalletsBatch: async () => [],
  calls: {
    assertCompliance: [],
    createFundingAuthorizationNonce: [],
    createFundingExecutionGrant: [],
    consumeFundingExecutionGrant: [],
    prepareCreateAndFundDealCall: [],
    screenWalletsBatch: [],
    signFundingAuthorization: [],
  },
  reset() {
    this.assertCompliance = (...args) => undefined;
    this.createFundingExecutionGrant = async () => ({
      id: 'grant-id-1',
    });
    this.consumeFundingExecutionGrant = async () => ({
      consultation_link_id: 'link-id-1',
      created_at: '2030-04-27T00:00:00.000Z',
      expires_at: '2030-04-27T00:05:00.000Z',
      id: 'grant-id-1',
      issued_by_wallet: '0x00000000000000000000000000000000000000AA',
      issued_to_wallet: '0x00000000000000000000000000000000000000AA',
      token_hash: 'hash-1',
      used_at: '2030-04-27T00:03:00.000Z',
    });
    this.getByConsultationLinkId = async () => null;
    this.getById = async () => null;
    this.prepareCreateAndFundDealCall = (input) => ({
      chain_id: 84532,
      contract_address: '0x0000000000000000000000000000000000000001',
      data: '0x' + '1'.repeat(64),
      function_name: 'createAndFundDeal',
    });
    this.createFundingAuthorizationNonce = () => '0x' + '2'.repeat(64);
    this.signFundingAuthorization = async () => '0x' + '3'.repeat(130);
    this.screenWalletsBatch = async () => [];
    this.calls = {
      assertCompliance: [],
      createFundingAuthorizationNonce: [],
      createFundingExecutionGrant: [],
      consumeFundingExecutionGrant: [],
      prepareCreateAndFundDealCall: [],
      screenWalletsBatch: [],
      signFundingAuthorization: [],
    };
  },
};

global.__fundingComplianceMocks = mocks;

const root = path.resolve(__dirname, '../../');

const consultationLinksRepoPath = path.resolve(root, 'server/repositories/consultation-links.ts');
require.cache[consultationLinksRepoPath] = makeEntry(consultationLinksRepoPath, {
  ConsultationLinksRepositoryError,
  getById: (...args) => mocks.getById(...args),
});

const dealsRepoPath = path.resolve(root, 'server/repositories/deals.ts');
require.cache[dealsRepoPath] = makeEntry(dealsRepoPath, {
  DealsRepositoryError,
  getByConsultationLinkId: (...args) => mocks.getByConsultationLinkId(...args),
});

const fundingExecutionGrantsRepoPath = path.resolve(root, 'server/repositories/funding-execution-grants.ts');
require.cache[fundingExecutionGrantsRepoPath] = makeEntry(fundingExecutionGrantsRepoPath, {
  FundingExecutionGrantsRepositoryError: class FundingExecutionGrantsRepositoryError extends Error {
    constructor(message, code) {
      super(message);
      this.name = 'FundingExecutionGrantsRepositoryError';
      this.code = code;
    }
  },
  createFundingExecutionGrant: (...args) => {
    mocks.calls.createFundingExecutionGrant.push(args);
    return mocks.createFundingExecutionGrant(...args);
  },
  consumeFundingExecutionGrant: (...args) => {
    mocks.calls.consumeFundingExecutionGrant.push(args);
    return mocks.consumeFundingExecutionGrant(...args);
  },
});

const escrowPath = path.resolve(root, 'lib/base/consult-escrow.ts');
require.cache[escrowPath] = makeEntry(escrowPath, {
  ConsultEscrowConfigError,
  getConsultEscrowContractAddress: () => '0x0000000000000000000000000000000000000001',
  getConsultEscrowChainId: () => 84532,
  prepareCreateAndFundDealCall: (...args) => {
    mocks.calls.prepareCreateAndFundDealCall.push(args[0]);
    return mocks.prepareCreateAndFundDealCall(...args);
  },
});

const fundingAuthorizationPath = path.resolve(root, 'lib/base/funding-authorization.ts');
require.cache[fundingAuthorizationPath] = makeEntry(fundingAuthorizationPath, {
  createFundingAuthorizationNonce: (...args) => {
    mocks.calls.createFundingAuthorizationNonce.push(args);
    return mocks.createFundingAuthorizationNonce(...args);
  },
  signFundingAuthorization: (...args) => {
    mocks.calls.signFundingAuthorization.push(args);
    return mocks.signFundingAuthorization(...args);
  },
});

const complianceServicePath = path.resolve(root, 'server/services/compliance.ts');
require.cache[complianceServicePath] = makeEntry(complianceServicePath, {
  screenWalletsBatch: (...args) => {
    mocks.calls.screenWalletsBatch.push(args);
    return mocks.screenWalletsBatch(...args);
  },
});

const errorMappingPath = path.resolve(root, 'lib/compliance/error-mapping.ts');
require.cache[errorMappingPath] = makeEntry(errorMappingPath, {
  ComplianceBlockedError,
  assertCompliance: (...args) => {
    mocks.calls.assertCompliance.push(args);
    return mocks.assertCompliance(...args);
  },
  complianceErrorToHttpResponse: () => { throw new Error('not mocked'); },
  withComplianceErrorHandling: (handler) => handler,
});
