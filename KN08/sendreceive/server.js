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
const PORT = parseInt(process.env.PORT || '8003', 10);

const cryptosUrl = (id) => `${ACCOUNT_BASE_URL}/Account/Cryptos/?userId=${id}`;
const friendsUrl = (id) => `${ACCOUNT_BASE_URL}/Account/Friends/?userId=${id}`;
const addCryptoUrl = (id, amount) => `${ACCOUNT_BASE_URL}/Account/AddCrypto?userId=${id}&amount=${amount}`;
const removeCryptoUrl = (id, amount) => `${ACCOUNT_BASE_URL}/Account/RemoveCrypto?userId=${id}&amount=${amount}`;

async function getBalance(id) {
  const res = await fetch(cryptosUrl(id));
  if (!res.ok) throw new Error(`Account Cryptos returned ${res.status}`);
  return parseInt(await res.text(), 10) || 0;
}

async function getFriends(id) {
  const res = await fetch(friendsUrl(id));
  if (!res.ok) throw new Error(`Account Friends returned ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// Account exposes AddCrypto / RemoveCrypto as POST endpoints with the
// parameters in the query string (?userId=&amount=), not a JSON body.
async function postCrypto(url) {
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error(`Account call ${url} returned ${res.status}`);
}

app.get('/', (req, res) => res.send('SendReceive up'));

app.post('/send', async (req, res) => {
  const body = req.body || {};
  const id = parseInt(body.id, 10);
  const receiverId = parseInt(body.receiverId, 10);
  const amount = parseInt(body.amount, 10);
  if (!Number.isInteger(id) || !Number.isInteger(receiverId) || !Number.isInteger(amount) || amount <= 0 || id === receiverId) {
    return res.json(false);
  }
  try {
    const friends = await getFriends(id);
    const isFriend = friends.some((f) => parseInt(f.id, 10) === receiverId);
    if (!isFriend) return res.json(false);

    const balance = await getBalance(id);
    if (balance < amount) return res.json(false);

    await postCrypto(removeCryptoUrl(id, amount));
    await postCrypto(addCryptoUrl(receiverId, amount));
    res.json(true);
  } catch (err) {
    console.error('send failed:', err.message);
    res.json(false);
  }
});

app.listen(PORT, () => console.log(`SendReceive listening on ${PORT}, account at ${ACCOUNT_BASE_URL}`));
