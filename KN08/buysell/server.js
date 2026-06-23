const express = require('express');

const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ type: () => true }));

const ACCOUNT_BASE_URL = process.env.ACCOUNT_BASE_URL || 'http://localhost:8080';
const PORT = parseInt(process.env.PORT || '8002', 10);

const cryptosUrl = (id) => `${ACCOUNT_BASE_URL}/Account/Cryptos/?userId=${id}`;
const addCryptoUrl = (id, amount) => `${ACCOUNT_BASE_URL}/Account/AddCrypto?userId=${id}&amount=${amount}`;
const removeCryptoUrl = (id, amount) => `${ACCOUNT_BASE_URL}/Account/RemoveCrypto?userId=${id}&amount=${amount}`;

async function getBalance(id) {
  const res = await fetch(cryptosUrl(id));
  if (!res.ok) throw new Error(`Account Cryptos returned ${res.status}`);
  return parseInt(await res.text(), 10) || 0;
}

// Account exposes AddCrypto / RemoveCrypto as POST endpoints with the
// parameters in the query string (?userId=&amount=), not a JSON body.
async function postCrypto(url) {
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error(`Account call ${url} returned ${res.status}`);
}

function parseRequest(body) {
  const id = parseInt(body.id, 10);
  const amount = parseInt(body.amount, 10);
  if (!Number.isInteger(id) || !Number.isInteger(amount) || amount <= 0) return null;
  return { id, amount };
}

app.get('/', (req, res) => res.send('BuySell up'));

app.post('/buy', async (req, res) => {
  const data = parseRequest(req.body || {});
  if (!data) return res.json(false);
  try {
    await postCrypto(addCryptoUrl(data.id, data.amount));
    res.json(true);
  } catch (err) {
    console.error('buy failed:', err.message);
    res.json(false);
  }
});

app.post('/sell', async (req, res) => {
  const data = parseRequest(req.body || {});
  if (!data) return res.json(false);
  try {
    const balance = await getBalance(data.id);
    const toRemove = Math.min(data.amount, balance);
    if (toRemove > 0) await postCrypto(removeCryptoUrl(data.id, toRemove));
    res.json(true);
  } catch (err) {
    console.error('sell failed:', err.message);
    res.json(false);
  }
});

app.listen(PORT, () => console.log(`BuySell listening on ${PORT}, account at ${ACCOUNT_BASE_URL}`));
