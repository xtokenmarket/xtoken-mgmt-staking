import hre, { ethers } from "hardhat";
import { Artifact } from "hardhat/types";
import { BigNumber } from "@ethersproject/bignumber";
import axios from "axios";
import { Signer } from "ethers";

import { unlockAccount } from "../../test/utils";
import { RevenueController } from "../../typechain";

const revenueControllerAddress = "0x37310ee55D433E51530b3efE41990360D6dBCFC3";
const xtkAddress = "0x7F3EDcdD180Dbe4819Bd98FeE8929b5cEdB3AdEB";

const managerAddress = "0x4c0c29539c463af348f8cba8c02d644a8d68c320";
const fundAddress = "0x704De5696dF237c5B9ba0De9ba7e0C63dA8eA0Df"; // xAAVEb
const feeBalances: any = ["140616620312189510107"];

async function main(): Promise<void> {
  let manager: Signer;

  await unlockAccount(managerAddress);
  manager = await ethers.provider.getSigner(managerAddress);

  const rcArtifacts: Artifact = await hre.artifacts.readArtifact("RevenueController");
  const revenueController = <RevenueController>await ethers.getContractAt(rcArtifacts.abi, revenueControllerAddress);
  const fundIndex: BigNumber = await revenueController.getFundIndex(fundAddress);
  const fundAssets: string[] = await revenueController.getFundAssets(fundAddress);

  let apiUrl;
  let response;
  let calldata;

  if (fundAssets.length > 0) {
    apiUrl = `https://api.1inch.exchange/v3.0/1/swap?fromTokenAddress=${fundAssets[0]}&toTokenAddress=${xtkAddress}&amount=${feeBalances[0]}&fromAddress=${revenueControllerAddress}&slippage=1&disableEstimate=true`;
    response = await axios.get(apiUrl);
    calldata = response.data.tx.data;

    const claimAndSwapData: any[] = [];
    for (let i = 1; i < fundAssets.length; i++) {
      claimAndSwapData[i] = [];
    }
    claimAndSwapData[0] = calldata;
    await revenueController.connect(manager).claimAndSwap(fundIndex, claimAndSwapData);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
