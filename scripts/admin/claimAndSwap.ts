import { ethers } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import axios from "axios";

import { ETH_ADDRESS } from "../../test/utils";
import { RevenueController, IxAsset } from "../../typechain";
import { unlockAccount } from "../../test/utils";
import addresses from "./address.json";

const revenueControllerAddress = addresses.revenueController;
const xtkAddress = addresses.xtk;

const managerAddress = addresses.manager;
const fundAddress = addresses.xAAVEb;
const feeAssets = [ETH_ADDRESS, addresses.aave];

async function main(): Promise<void> {
  await unlockAccount(managerAddress);
  const manager = await ethers.provider.getSigner(managerAddress);

  const revenueController = <RevenueController>(
    await ethers.getContractAt("RevenueController", revenueControllerAddress)
  );
  const xAsset = <IxAsset>await ethers.getContractAt("IxAsset", fundAddress);

  await revenueController.connect(manager).addFund(fundAddress, feeAssets);

  const fundIndex: BigNumber = await revenueController.getFundIndex(fundAddress);
  let fundAssets: string[];
  let feeBalances: BigNumber[];
  [fundAssets, feeBalances] = await xAsset.getWithdrawableFees();

  let apiUrl;
  let response;
  let calldata;

  if (fundAssets.length > 0) {
    apiUrl = `https://api.1inch.exchange/v3.0/1/swap?fromTokenAddress=${fundAssets[0]}&toTokenAddress=${xtkAddress}&amount=${feeBalances[0]}&fromAddress=${revenueControllerAddress}&slippage=1&disableEstimate=true`;
    response = await axios.get(apiUrl);
    calldata = response.data.tx.data;

    const claimAndSwapData: any[] = [];
    for (let i = 0; i < fundAssets.length; i++) {
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
