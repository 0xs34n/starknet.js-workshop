import fs from "fs";

// Install the latest version of starknet with npm install starknet@next and import starknet
import {
  Contract,
  defaultProvider,
  ec,
  encode,
  hash,
  json,
  number,
  stark,
} from "starknet";
import { transformCallsToMulticallArrays } from "./node_modules/starknet/utils/transaction";

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

// Unlike in Ethereum where a accountContract is created with a public and private key pair,
// StarkNet Accounts are the only way to sign transactions and messages, and verify signatures.
// Therefore a Account - Contract interface is needed.

// Generate public and private key pair.
const keyPair = ec.genKeyPair();
const starkKeyPub = ec.getStarkKey(keyPair);

// Deploy the Account contract and wait for it to be verified on StarkNet.
console.log("Deployment Tx - Account Contract to StarkNet...");
const accountResponse = await defaultProvider.deployContract({
  contract: compiledArgentAccount,
  addressSalt: starkKeyPub,
});

// Wait for the deployment transaction to be accepted on StarkNet
console.log(
  "Waiting for Tx to be Accepted on Starknet - Argent Account Deployment..."
);
await defaultProvider.waitForTransaction(accountResponse.transaction_hash);

// Use your new account address
const accountContract = new Contract(
  compiledArgentAccount.abi,
  accountResponse.address
);

// Initialize argent account
console.log("Invoke Tx - Initialize Argnet Account...");
const { transaction_hash: initializeTxHash } = await accountContract.invoke(
  "initialize",
  {
    signer: starkKeyPub,
    guardian: "0",
  }
);
console.log(
  "Waiting for Tx to be Accepted on Starknet - Initialize Argent Account..."
);
await defaultProvider.waitForTransaction(initializeTxHash);

// Deploy an ERC20 contract and wait for it to be verified on StarkNet.
console.log("Deployment Tx - ERC20 Contract to StarkNet...");
const { transaction_hash: erc20TxHash, address: erc20AddressLocal } =
  await defaultProvider.deployContract({
    contract: compiledErc20,
  });

// Wait for the deployment transaction to be accepted on StarkNet
console.log("Waiting for Tx to be Accepted on Starknet - ERC20 Deployment...");
await defaultProvider.waitForTransaction(erc20TxHash);

// Get the erc20 contract address
const erc20Address = erc20AddressLocal;

// Create a new erc20 contract object
const erc20 = new Contract(compiledErc20.abi, erc20Address);

// Mint 1000 tokens to accountContract address
console.log(
  `Invoke Tx - Minting 1000 tokens to ${accountContract.connectedTo}...`
);
const { transaction_hash: mintTxHash } = await erc20.invoke("mint", {
  recipient: accountContract.connectedTo,
  amount: "1000",
});

// Wait for the invoke transaction to be accepted on StarkNet
console.log(`Waiting for Tx to be Accepted on Starknet - Minting...`);
await defaultProvider.waitForTransaction(mintTxHash);

const readNonce = await accountContract.call("get_nonce").nonce;

// Check balance - should be 1000
console.log(`Calling StarkNet for accountContract balance...`);
const balanceBeforeTransfer = await erc20.call("balance_of", {
  user: accountContract.connectedTo,
}).res;

console.log(
  `accountContract Address ${accountContract.connectedTo} has a balance of:`,
  number.toBN(balanceBeforeTransfer).toString()
);

// Get the nonce of the account and prepare transfer tx
console.log(`Calling StarkNet for accountContract nonce...`);
const nonce = (await accountContract.call("get_nonce")).nonce.toString();
const calls = [
  {
    contractAddress: erc20Address,
    entrypoint: "transfer",
    calldata: [erc20Address, "10"],
  },
];
const msgHash = hash.hashMulticall(
  accountContract.connectedTo,
  calls,
  nonce,
  "0"
);

const { callArray, calldata } = transformCallsToMulticallArrays(calls);

// sign tx to transfer 10 tokens
const signature = ec.sign(keyPair, msgHash);

// Execute tx transfer of 10 tokens
console.log(`Invoke Tx - Transfer 10 tokens back to erc20 contract...`);
const transferTxHash = await accountContract.invoke(
  "__execute__",
  {
    call_array: callArray,
    calldata,
    nonce,
  },
  signature
).transaction_hash;

// Wait for the invoke transaction to be accepted on StarkNet
console.log(`Waiting for Tx to be Accepted on Starknet - Transfer...`);
await defaultProvider.waitForTransaction(transferTxHash);

// Check balance after transfer - should be 990
console.log(`Calling StarkNet for accountContract balance...`);
const balanceAfterTransfer = await erc20.call("balance_of", {
  user: accountContract.connectedTo,
}).res;

console.log(
  `accountContract Address ${accountContract.connectedTo} has a balance of:`,
  balanceAfterTransfer
);
