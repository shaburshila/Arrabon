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

const mocks = {
  calls: {
    delete: 0,
    eq: [],
    from: [],
    gt: [],
    gte: [],
    is: [],
    lte: [],
    select: [],
    update: [],
  },
  countResult: {
    count: 2,
    error: null,
  },
  deleteResult: {
    error: null,
  },
  updateResult: {
    error: null,
  },
};

mocks.reset = () => {
  mocks.calls = {
    delete: 0,
    eq: [],
    from: [],
    gt: [],
    gte: [],
    is: [],
    lte: [],
    select: [],
    update: [],
  };
  mocks.countResult = {
    count: 2,
    error: null,
  };
  mocks.deleteResult = {
    error: null,
  };
  mocks.updateResult = {
    error: null,
  };
};

global.__authNoncesRepositoryMocks = mocks;

const root = path.resolve(__dirname, '../../');
const dbServerPath = path.resolve(root, 'lib/db/server.ts');

function makeQueryBuilder() {
  return {
    operation: null,
    from(table) {
      mocks.calls.from.push(table);
      return this;
    },
    select(columns, options) {
      mocks.calls.select.push([columns, options]);
      if (options && options.count === 'exact' && options.head === true) {
        this.operation = 'count';
      }
      return this;
    },
    update(payload) {
      this.operation = 'update';
      mocks.calls.update.push(payload);
      return this;
    },
    delete() {
      this.operation = 'delete';
      mocks.calls.delete += 1;
      return this;
    },
    eq(column, value) {
      mocks.calls.eq.push([column, value]);
      return this;
    },
    is(column, value) {
      mocks.calls.is.push([column, value]);
      return this;
    },
    gt(column, value) {
      mocks.calls.gt.push([column, value]);
      if (this.operation === 'update') {
        return Promise.resolve(mocks.updateResult);
      }
      return this;
    },
    gte(column, value) {
      mocks.calls.gte.push([column, value]);
      if (this.operation === 'count') {
        return Promise.resolve(mocks.countResult);
      }
      return this;
    },
    lte(column, value) {
      mocks.calls.lte.push([column, value]);
      if (this.operation === 'delete') {
        return Promise.resolve(mocks.deleteResult);
      }
      return this;
    },
  };
}

require.cache[dbServerPath] = makeEntry(dbServerPath, {
  getServerDbClient: () => makeQueryBuilder(),
});
