// init sqlite db
const dbFile = './hashstack.db';
const fs = require('fs');

const exists = fs.existsSync(dbFile);
const sqlite3 = require('sqlite3').verbose();
const ooPatch = require('json8-patch');
const oo = require('json8');

const db = new sqlite3.Database(dbFile);
db.serialize(() => {
  if (!exists) {
    db.run('CREATE TABLE blockchain (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, previousHash TEXT, data TEXT, hash TEXT, nonce INTEGER );');
    console.log('Database initialized!');
  } else {
    console.log('Database loaded!');
  }
});
class Block {
  constructor(index, timestamp, previousHash, data, hash, nonce) {
    this.index = index * 1;
    this.timestamp = timestamp;
    this.previousHash = previousHash;
    this.data = data;
    this.nonce = nonce * 1 || 0;
    this.hash = hash;
  }

  str() {
    return (
      `${
        this.index
      }${this.timestamp
      }${this.previousHash || 'undefined'
      }${this.data
      }${this.nonce}`
    );
  }

  toJSON() {
    return {
      index: this.index,
      timestamp: this.timestamp,
      previousHash: this.previousHash,
      data: this.data,
      nonce: this.nonce,
      hash: this.hash,
    };
  }

  toString() {
    return `Block #${this.index} [previousHash: ${
      this.previousHash
    }, timestamp: ${new Date(this.timestamp)}, data: ${this.data}, hash: ${
      this.hash
    }]`;
  }

  calculateHash() {
    const txt = this.str();
    return hash(txt);
  }

  mineBlock(difficulty) {
    this.nonce = 0;
    while (this.hash.slice(0, difficulty) != '0'.repeat(difficulty)) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
  }
}
class Blockchain {
  constructor(o, d) {
    this.difficulty = 1;
    if (o) {
      this.blocks = o.map((e) => new Block(
        e.index,
        e.timestamp,
        e.previousHash,
        e.data,
        e.hash,
        e.nonce,
      ));
    } else {
      this.blocks = [];
    }
  }

  toJSON() {
    return this.blocks.map((e) => e.toJSON());
  }

  latestBlock() {
    return this.blocks[this.blocks.length - 1];
  }

  newBlock(data) {
    const latestBlock = this.latestBlock();
    let { index } = latestBlock || {};
    if (typeof index !== 'number') {
      index = -1;
    }
    index++;
    const block = new Block(
      index,
      new Date().valueOf(),
      (latestBlock || {}).hash,
      data,
    );
    block.hash = block.calculateHash();
    block.mineBlock(this.difficulty);
    return block;
  }

  validateFirstBlock() {
    const firstBlock = this.blocks[0];
    if (!firstBlock) return true; // blockchain is empty
    if (firstBlock.index != 0) {
      throw new Error('First block is not at index 0!');
    }

    if (firstBlock.previousHash) {
      throw new Error('First block has a previous hash!');
    }

    const trueHash = firstBlock.calculateHash();
    if (
      firstBlock.hash == null
      || trueHash != firstBlock.hash
    ) {
      throw new Error('First block has invalid or missing hash!');
    }

    return true;
  }

  isValidNewBlock(newBlock, previousBlock) {
    if (newBlock != null && previousBlock != null) {
      if (previousBlock.index + 1 != newBlock.index) {
        return false;
      }

      if (
        newBlock.previousHash == null
        || newBlock.previousHash != previousBlock.hash
      ) {
        return false;
      }

      if (
        newBlock.hash == null
        || (newBlock.calculateHash()) != newBlock.hash
      ) {
        return false;
      }

      return true;
    }

    return false;
  }

  validateBlockChain() {
    this.validateFirstBlock(); // Will throw if invalid

    for (let i = 1; i < this.blocks.length; i++) {
      const currentBlock = this.blocks[i];
      const previousBlock = this.blocks[i - 1];

      if (!(this.isValidNewBlock(currentBlock, previousBlock))) {
        throw new Error(`Block ${i} is invalid!`);
      }
    }

    return true;
  }

  toString() {
    return this.blocks.map((e) => e.toString()).join('\n');
  }
}

function loadChain() {
  return new Promise((cb, errcb) => {
    db.all('SELECT * from blockchain', (err, rows) => {
      if (err) return errcb(err);
      rows = rows || [];
      cb(rows.map((e) => {
        const {
          id, timestamp, previousHash, data, hash, nonce,
        } = e;
        return {
          index: id, timestamp, previousHash, data, hash, nonce,
        };
      }));
    });
  });
}

function hash(message) {
  let txtHash = '';
  const rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    message,
    Utilities.Charset.UTF_8,
  );
  for (i = 0; i < rawHash.length; i++) {
    let hashVal = rawHash[i];

    if (hashVal < 0) {
      hashVal += 256;
    }
    if (hashVal.toString(16).length == 1) {
      txtHash += '0';
    }
    txtHash += hashVal.toString(16);
  }
  // change below to "txtHash.toUpperCase()" if needed
  return txtHash;
}

(async () => {
  const blockchain = new Blockchain();
  console.log(
    `Blockchain valid? ${
      (blockchain.validateBlockChain()) ? 'yes' : 'no'}`,
  );
  blockchain.blocks.map((e) => console.log(e.str()));
  const db = new Proxy({}, {
    get: (o, k) => o[k],
    set: (o, k, v) => {
      const old = oo.clone(o);
      o[k] = v;
      blockchain.blocks.push(blockchain.newBlock(JSON.stringify(ooPatch.diff(old, o))));
      return o[k];
    },
  });
})();
// db.run("INSERT INTO blockchain (id, timestamp, previousHash, data, hash, nonce) VALUES (?,?,?,?,?,?);")
