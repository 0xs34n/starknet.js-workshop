import fs from fs;

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
  import { transformCallsToMulticallArrays } from "./node_modules/starknet/utils/transaction.js";
const starkKeyPair = ec.getKeyPair("0x055c3d94419505d7ff1e7ee75beae9dead5e82719aad41946f997f4d359ff7db");


console.log("Reading Argent Account Contract...");
const compiledArgentAccount = json.parse(
  fs.readFileSync("./ArgentAccount.json").toString("ascii")
);
console.log("Reading gateway Contract...");
const compiledGateway = json.parse(
  fs.readFileSync("./gateway.json").toString("ascii")
);


const gateway = new Contract(compiledGateway.abi, "0x06c9f6f1061c9ce8f63a02a100decf01cceeca3f278a61a588c754805b6ae2f1")
const nonce = (await accountContract.call("get_nonce")).nonce.toString();
const calls ={
    contractAddress : gateway.address,
    entrypoint : "initiateWithdraw",
    calldata : ["<l1_tokenAddress>","<l2_tokenAddress>","12","<l1Owner>","<l2Owner>"]
}

const withdrawMsgHash = hash.hashMulticall("0x718f1bbf1306a00a6f859f8da253742284fba457eb8a8aae12313b431090615", calls, nonce, "0");
const sig = ec.sign(starkKeyPair, withdrawMsgHash)
console.log(sig);
const {callArray, calldata} = transformCallsToMulticallArrays(calls)

const {transaction_hash : withdrawHash} = await accountContract. __execute__(
    callArray,
    calldata,
    nonce,
    sig
);

const withdraw_hash= await defaultProvider.waitForTransaction(transaction_hash) 
console.log(withdraw_hash);
