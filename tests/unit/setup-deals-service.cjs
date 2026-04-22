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

class DealsRepositoryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'DealsRepositoryError';
    this.code = code;
  }
}

const mocks = {
  getByConsultationLinkId: async () => null,
  getById: async () => null,
  getByOnchainDealId: async () => null,
  insertConfirmedDeal: async () => ({ id: 'deal-id-1' }),
  insertConfirmedDealAndMaybeConsumeLink: async () => ({ id: 'deal-id-1' }),
  updateStatus: async () => ({ id: 'link-id-1', status: 'Consumed' }),
  DealsRepositoryError,
};

global.__dealsServiceMocks = mocks;

const root = path.resolve(__dirname, '../../');

const dealsRepoPath = path.resolve(root, 'server/repositories/deals.ts');
require.cache[dealsRepoPath] = makeEntry(dealsRepoPath, {
  DealsRepositoryError,
  getByConsultationLinkId: (...args) => mocks.getByConsultationLinkId(...args),
  getByOnchainDealId: (...args) => mocks.getByOnchainDealId(...args),
  insertConfirmedDeal: (...args) => mocks.insertConfirmedDeal(...args),
  insertConfirmedDealAndMaybeConsumeLink: (...args) => mocks.insertConfirmedDealAndMaybeConsumeLink(...args),
});

const consultationLinksRepoPath = path.resolve(root, 'server/repositories/consultation-links.ts');
require.cache[consultationLinksRepoPath] = makeEntry(consultationLinksRepoPath, {
  getById: (...args) => mocks.getById(...args),
  updateStatus: (...args) => mocks.updateStatus(...args),
});
