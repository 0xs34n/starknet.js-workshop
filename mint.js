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
import { transformCallsToMulticallArrays } from "./node_modules/starknet/utils/transaction.js";

// TODO: Change to OZ account contract
console.log("Reading Argent Account Contract...");
const compiledArgentAccount = json.parse(
  fs.readFileSync("./ArgentAccount.json").toString("ascii")
);
console.log("Reading ERC20 Contract...");
const compiledErc20 = json.parse(
  fs.readFileSync("./ERC721.json").toString("ascii")
);
const ERC721 = "0x17f89a02f2706ddad8fb4a22cafe6c40538684e36f056f0e8bb387f6c2fac4c"
// const gatewaycontract_Address = "0x06c9f6f1061c9ce8f63a02a100decf01cceeca3f278a61a588c754805b6ae2f1"
// {
//     "address": "0x718f1bbf1306a00a6f859f8da253742284fba457eb8a8aae12313b431090615",
//     "privateKey": "0x055c3d94419505d7ff1e7ee75beae9dead5e82719aad41946f997f4d359ff7db",
//     "publicKey": "0x06bfddf504b451651047b416f687fda599cd60dfc16d462900a3b1132b7a568f"
// }

const starkKeyPair = ec.getKeyPair("0x055c3d94419505d7ff1e7ee75beae9dead5e82719aad41946f997f4d359ff7db");

// Use your new account address
const accountContract = new Contract(
  compiledArgentAccount.abi,
  "0x718f1bbf1306a00a6f859f8da253742284fba457eb8a8aae12313b431090615"
);

// Create a new erc20 contract object
const erc721 = new Contract(compiledErc20.abi, ERC721);
const nonce = (await accountContract.call("get_nonce")).nonce.toString();
const calls = [
    {
      contractAddress: erc721.address,
      entrypoint: "mint",
      calldata: ["1","0x718f1bbf1306a00a6f859f8da253742284fba457eb8a8aae12313b431090615","2", "123", "1234"],
    },
  ];

const mintmsgHash = hash.hashMulticall("0x718f1bbf1306a00a6f859f8da253742284fba457eb8a8aae12313b431090615", calls, nonce, "0");

const { callArrayA, calldataA } = transformCallsToMulticallArrays(calls);
const sig = ec.sign(starkKeyPair, mintmsgHash)

const { transaction_hash: transferTxHash } = await accountContract.__execute__(
    callArrayA,
    calldataA,
    newNonce,
    sig
  );

  const mint_tx = await defaultProvider.waitForTransaction(transaction_hash)
  console.log("minting success");
  console.log(mint_tx);

// Wait for the invoke transaction to be accepted on StarkNet
