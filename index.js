// init sqlite db
const dbFile = './hashstack.db';
const fs = require('fs');
const exists = fs.existsSync(dbFile);
const sqlite3 = require('sqlite3').verbose();
const ooPatch = require('json8-patch');
const oo = require('json8');
const crypto = require('crypto');

const db = new sqlite3.Database(dbFile);
db.serialize(() => {
  if (!exists) {
    db.run('CREATE TABLE blockchain (id INTEGER PRIMARY KEY, timestamp TEXT, previousHash TEXT, data TEXT, hash TEXT, nonce INTEGER );');
    console.log('Database initialized!');
  } else {
    console.log('Database loaded!');
  }
});
class Block {
  constructor(index, timestamp, previousHash, data, hash, nonce) {
    this.index = index * 1;
    this.timestamp = Math.floor(timestamp)+"";
    this.previousHash = previousHash||undefined;
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
  constructor() {
    this.difficulty = 1;
    this._blocks = [];
  }

  async init() {
    return await new Promise((cb, errcb) => {
      db.all('SELECT * from blockchain', (err, rows) => {
        if (err) return errcb(err);
        rows = rows || [];
        this._blocks=rows.map((e) => {
          const {
            id, timestamp, previousHash, data, hash, nonce,
          } = e;
          return new Block(
            id,
            timestamp,
            previousHash,
            data,
            hash,
            nonce,
          )
        });
        cb();
      });
    });
  }

  latestBlock() {
    return this._blocks[this._blocks.length - 1];
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
      data
    );
    block.hash = block.calculateHash();
    block.mineBlock(this.difficulty);
    return block;
  }

  addBlock(block){
    if(!this.isValidNewBlock(block,this.latestBlock())) throw new Error("Invalid block!")
    this._blocks.push(block)
    let {index, timestamp, previousHash, data, hash, nonce}=block;
    db.run("INSERT INTO blockchain (id, timestamp, previousHash, data, hash, nonce) VALUES (?,?,?,?,?,?);",index, timestamp, previousHash, data, hash, nonce)
  }

  get blocks(){
    return this._blocks
  }

  validateFirstBlock(block) {
    const firstBlock = block||this._blocks[0];
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
        console.log("Not directly after current block.")
        return false;
      }

      if (
        newBlock.previousHash == null
        || newBlock.previousHash != previousBlock.hash
      ) {
        console.log("invalid previous hash")
        return false;
      }

      if (
        newBlock.hash == null
        || (newBlock.calculateHash()) != newBlock.hash
      ) {
        console.log("invalid hash")
        return false;
      }

      return true;
    }
    if(newBlock&&newBlock.index==0&&!previousBlock){
      try{
        this.validateFirstBlock(newBlock)
        return true;
      }catch(e){
        return false;
      }
    }
    return false;
  }

  validateBlockChain() {
    this.validateFirstBlock(); // Will throw if invalid

    for (let i = 1; i < this._blocks.length; i++) {
      const currentBlock = this._blocks[i];
      const previousBlock = this._blocks[i - 1];

      if (!(this.isValidNewBlock(currentBlock, previousBlock))) {
        throw new Error(`Block ${i} is invalid!`);
      }
    }

    return true;
  }

  toString() {
    return this._blocks.map((e) => e.toString()).join('\n');
  }
}

function hash(message) {
  const hash = crypto.createHash('sha256');
  hash.update(message);
  return hash.digest('hex');
}

let blockchain, odb;
(async () => {
  blockchain = new Blockchain();
  await blockchain.init()
  console.log(
    `Blockchain valid? ${
      (blockchain.validateBlockChain()) ? 'yes' : 'no'}`,
  );
  blockchain.blocks.map((e) => console.log(e.str()));
  odb = new Proxy({}, {
    get: (o, k) => o[k],
    set: (o, k, v) => {
      const old = oo.clone(o);
      o[k] = v;
      blockchain.addBlock(blockchain.newBlock(JSON.stringify(ooPatch.diff(old, o))));
      return o[k];
    },
  });
})();
