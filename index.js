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
const { compileCalldata } = stark;

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

// Unlike in Ethereum where a wallet is created with a public and private key pair,
// StarkNet Accounts are the only way to sign transactions and messages, and verify signatures.
// Therefore a Account - Contract interface is needed.

// Generate public and private key pair.
const keyPair = ec.genKeyPair();
const starkKeyPub = ec.getStarkKey(keyPair);

// Deploy the Account contract and wait for it to be verified on StarkNet.
console.log("Deployment Tx - Account Contract to StarkNet...");
const { transaction_hash: accountTxHash, address: walletAddressLocal } =
  await defaultProvider.deployContract({
    contract: compiledArgentAccount,
    constructorCalldata: compileCalldata({
      signer: starkKeyPub,
      guardian: "0",
      L1_address: "0",
    }),
    addressSalt: starkKeyPub,
  });

// Wait for the deployment transaction to be accepted on StarkNet
console.log(
  "Waiting for Tx to be Accepted on Starknet - Argent Account Deployment..."
);
await defaultProvider.waitForTransaction(accountTxHash);

// Use your new account address
const walletAddress = walletAddressLocal;
const wallet = new Contract(compiledArgentAccount.abi, walletAddress);

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

// Mint 1000 tokens to wallet address
console.log(`Invoke Tx - Minting 1000 tokens to ${walletAddress}...`);
const { transaction_hash: mintTxHash, transaction_hash: txErc20Mint } =
  await erc20.invoke("mint", {
    recipient: walletAddress,
    amount: "1000",
  });

// Wait for the invoke transaction to be accepted on StarkNet
console.log(`Waiting for Tx to be Accepted on Starknet - Minting...`);
await defaultProvider.waitForTransaction(mintTxHash);

// Check balance - should be 1000
console.log(`Calling StarkNet for wallet balance...`);
const balanceBeforeTransfer = await erc20.call("balance_of", {
  user: walletAddress,
}).res;

console.log(
  `Wallet Address ${walletAddress} has a balance of:`,
  number.toBN(balanceBeforeTransfer).toString()
);

// Get the nonce of the account and prepare transfer tx
console.log(`Calling StarkNet for wallet nonce...`);
const { nonce } = await wallet.call("get_nonce");
const msgHash = encode.addHexPrefix(
  hash.hashMessage(
    wallet.connectedTo,
    erc20Address,
    stark.getSelectorFromName("transfer"),
    [erc20Address, "10"],
    nonce.toString()
  )
);
// sign tx to transfer 10 tokens
const signature = ec.sign(starkKeyPair, msgHash);

// Execute tx transfer of 10 tokens
console.log(`Invoke Tx - Transfer 10 tokens back to erc20 contract...`);
const { transaction_hash: transferTxHash } = await wallet.invoke(
  "execute",
  {
    to: erc20Address,
    selector: stark.getSelectorFromName("transfer"),
    calldata: [erc20Address, "10"],
    nonce: nonce.toString(),
  },
  signature
);

// Wait for the invoke transaction to be accepted on StarkNet
console.log(`Waiting for Tx to be Accepted on Starknet - Transfer...`);
await defaultProvider.waitForTransaction(transferTxHash);

// Check balance after transfer - should be 990
console.log(`Calling StarkNet for wallet balance...`);
const balanceAfterTransfer = await erc20.call("balance_of", {
  user: walletAddress,
}).res;

console.log(
  `Wallet Address ${walletAddress} has a balance of:`,
  balanceAfterTransfer
);
