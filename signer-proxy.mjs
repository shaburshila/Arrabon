import http from 'http';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http as viemHttp, hexToBytes, toHex, keccak256, encodePacked, toBytes } from 'viem';
import { baseSepolia } from 'viem/chains';

// Wallets from .env.local
const wallets = {
  seller: {
    key: '0xb5195d3944ef5daff3b39a560f0afbc1fa80dde521910bc22fad3f22b941cf20',
    address: '0x8B7851297180e085e227b67D8467c78690160709',
  },
  buyer: {
    key: '0x2a02ccb7fb883e17f4102a8f6d4975f0c3ad1b2ee0d4a47001950fb8944042b1',
    address: '0x46e2eedaBe595F295a81099C19E624AF9EEB02Ca',
  },
  admin: {
    key: '0x47088b17b776ef9e61148193e302937f4a38f8260ccd1e89583c8450949cf3c5',
    address: '0x2d9DcbB363f6CF83597015aF51b990088D7E7795',
  },
};

let activeWallet = wallets.seller;

const RPC_URL = 'https://base-sepolia.g.alchemy.com/v2/q0fn7_VC6t58_ypld5muB';

async function handleRequest(method, params) {
  const account = privateKeyToAccount(activeWallet.key);

  switch (method) {
    case 'eth_accounts':
    case 'eth_requestAccounts':
      return [activeWallet.address];

    case 'eth_chainId':
      return '0x' + (84532).toString(16); // Base Sepolia

    case 'net_version':
      return '84532';

    case 'personal_sign': {
      const [message, _address] = params;
      // message is hex-encoded
      const sig = await account.signMessage({
        message: { raw: hexToBytes(message) },
      });
      return sig;
    }

    case 'eth_sign': {
      const [_address, message] = params;
      const sig = await account.signMessage({
        message: { raw: hexToBytes(message) },
      });
      return sig;
    }

    case 'eth_signTypedData_v4': {
      const [_address, dataStr] = params;
      const typedData = JSON.parse(dataStr);
      const sig = await account.signTypedData(typedData);
      return sig;
    }

    case 'eth_sendTransaction': {
      const [tx] = params;
      const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: viemHttp(RPC_URL),
      });
      const hash = await client.sendTransaction({
        to: tx.to,
        value: tx.value ? BigInt(tx.value) : 0n,
        data: tx.data,
        gas: tx.gas ? BigInt(tx.gas) : undefined,
      });
      return hash;
    }

    case 'eth_getTransactionReceipt': {
      const res = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const json = await res.json();
      return json.result;
    }

    case 'eth_call':
    case 'eth_estimateGas':
    case 'eth_getBalance':
    case 'eth_blockNumber':
    case 'eth_getTransactionCount': {
      const res = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const json = await res.json();
      return json.result;
    }

    default:
      // Forward unknown methods to the RPC
      const res = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const json = await res.json();
      return json.result;
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/switch') {
    const url = new URL(req.url, 'http://localhost');
    // handled below
  }

  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost:3001');
    if (url.pathname === '/switch') {
      const wallet = url.searchParams.get('wallet');
      if (wallets[wallet]) {
        activeWallet = wallets[wallet];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, active: wallet, address: activeWallet.address }));
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Unknown wallet' }));
      }
      return;
    }
    if (url.pathname === '/active') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ wallet: Object.keys(wallets).find(k => wallets[k] === activeWallet), address: activeWallet.address }));
      return;
    }
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end();
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { method, params, id } = JSON.parse(body);
      console.log(`[signer] ${method}`, params?.slice(0,1));
      const result = await handleRequest(method, params || []);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id, result }));
    } catch (err) {
      console.error('[signer] error:', err.message);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32603, message: err.message } }));
    }
  });
});

server.listen(3001, () => {
  console.log('[signer-proxy] Listening on http://localhost:3001');
  console.log('[signer-proxy] Active wallet: seller', wallets.seller.address);
  console.log('[signer-proxy] Switch wallet: GET /switch?wallet=buyer|seller|admin');
});
