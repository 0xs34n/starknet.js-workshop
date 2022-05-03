import fs from "fs";

// Install the latest version of starknet with npm install starknet@next and import starknet
import {
  Contract,
  Account,
  defaultProvider,
  ec,
  encode,
  hash,
  json,
  number,
  stark,
  Provider,
} from "starknet";
import { transformCallsToMulticallArrays } from "./node_modules/starknet/utils/transaction.js";

const provider = process.env.STARKNET_PROVIDER_BASE_URL === undefined ?
  defaultProvider :
  new Provider({ baseUrl: process.env.STARKNET_PROVIDER_BASE_URL });

// TODO: Change to OZ account contract
console.log("Reading Argent Account Contract...");
const compiledArgentAccount = json.parse(
  fs.readFileSync("./ArgentAccount.json").toString("ascii")
);
console.log("Reading ERC20 Contract...");
const compiledErc20 = json.parse(
  fs.readFileSync("./ERC20.json").toString("ascii")
);

// Since there are no Externally Owned Accounts (EOA) in StarkNet,
// all Accounts in StarkNet are contracts.

// Unlike in Ethereum where a account is created with a public and private key pair,
// StarkNet Accounts are the only way to sign transactions and messages, and verify signatures.
// Therefore a Account - Contract interface is needed.

// Generate public and private key pair.
const privateKey = stark.randomAddress();

const starkKeyPair = ec.genKeyPair(privateKey);
const starkKeyPub = ec.getStarkKey(starkKeyPair);

// Deploy the Account contract and wait for it to be verified on StarkNet.
console.log("Deployment Tx - Account Contract to StarkNet...");
const accountResponse = await provider.deployContract({
  contract: compiledArgentAccount,
  addressSalt: starkKeyPub,
});

// Wait for the deployment transaction to be accepted on StarkNet
console.log(
  "Waiting for Tx to be Accepted on Starknet - Argent Account Deployment..."
);
await provider.waitForTransaction(accountResponse.transaction_hash);

const accountContract = new Contract(
  compiledArgentAccount.abi,
  accountResponse.address,
  provider
);

// Initialize argent account
console.log("Invoke Tx - Initialize Argnet Account...");
const initializeResponse = await accountContract.initialize(starkKeyPub, "0");
console.log(
  "Waiting for Tx to be Accepted on Starknet - Initialize Account..."
);
await provider.waitForTransaction(initializeResponse.transaction_hash);

// Use your new account address
const account = new Account(
  provider,
  accountResponse.address,
  starkKeyPair
);

// Deploy an ERC20 contract and wait for it to be verified on StarkNet.
console.log("Deployment Tx - ERC20 Contract to StarkNet...");
const erc20Response = await provider.deployContract({
  contract: compiledErc20,
});

// Wait for the deployment transaction to be accepted on StarkNet
console.log("Waiting for Tx to be Accepted on Starknet - ERC20 Deployment...");
await provider.waitForTransaction(erc20Response.transaction_hash);

// Get the erc20 contract address
const erc20Address = erc20Response.address;

// Create a new erc20 contract object
const erc20 = new Contract(compiledErc20.abi, erc20Address, provider);

// Mint 1000 tokens to account address
console.log(`Invoke Tx - Minting 1000 tokens to ${account.address}...`);
const { transaction_hash: mintTxHash } = await erc20.mint(
  account.address,
  "1000"
);

// Wait for the invoke transaction to be accepted on StarkNet
console.log(`Waiting for Tx to be Accepted on Starknet - Minting...`);
await provider.waitForTransaction(mintTxHash);

// Check balance - should be 1000
console.log(`Calling StarkNet for account balance...`);
const balanceBeforeTransfer = await erc20.balance_of(account.address);

console.log(
  `account Address ${account.address} has a balance of:`,
  number.toBN(balanceBeforeTransfer.res, 16).toString()
);

// Execute tx transfer of 10 tokens
console.log(`Invoke Tx - Transfer 10 tokens back to erc20 contract...`);
const { code, transaction_hash: transferTxHash } = await account.execute(
  {
    contractAddress: erc20Address,
    entrypoint: "transfer",
    calldata: [erc20Address, "10"],
  },
  undefined,
  { maxFee: "0" }
);

// Wait for the invoke transaction to be accepted on StarkNet
console.log(`Waiting for Tx to be Accepted on Starknet - Transfer...`);
await provider.waitForTransaction(transferTxHash);

// Check balance after transfer - should be 990
console.log(`Calling StarkNet for account balance...`);
const balanceAfterTransfer = await erc20.balance_of(account.address);

console.log(
  `account Address ${account.address} has a balance of:`,
  number.toBN(balanceAfterTransfer.res, 16).toString()
);
