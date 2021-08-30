import { ethers } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import axios from "axios";

import { ETH_ADDRESS } from "./../../test/utils/constants";
import { RevenueController, IxAsset, IERC20 } from "../../typechain";
import addresses from "./address.json";

const revenueControllerAddress = addresses.revenueController;
const xtkAddress = addresses.xtk;
const stakingModuleAddress = addresses.stakingModule;

const fundAddress = addresses.xINCHa;

async function main(): Promise<void> {
  console.log("Initiating contract instances...");
  const revenueController = <RevenueController>(
    await ethers.getContractAt("RevenueController", revenueControllerAddress)
  );
  const xAsset = <IxAsset>await ethers.getContractAt("IxAsset", fundAddress);
  const xtk = <IERC20>await ethers.getContractAt("IERC20", xtkAddress);

  console.log("Getting the fund index...");
  const fundIndex: BigNumber = await revenueController.getFundIndex(fundAddress);
  console.log("Fund Index: ", fundIndex.toString());

  let fundAssets: string[];
  let feeBalances: BigNumber[];

  console.log("Getting withdraw fees...");
  [fundAssets, feeBalances] = await xAsset.getWithdrawableFees();
  for (let i = 0; i < fundAssets.length; i++) {
    console.log(`${fundAssets[i]} <===> ${feeBalances[i]}`);
  }

  let apiUrl;
  let response;
  let calldata;
  let xtkBalanceBefore: BigNumber;
  let xtkBalanceAfter: BigNumber;

  xtkBalanceBefore = await xtk.balanceOf(stakingModuleAddress);
  console.log("StakingModule XTK balance before swap: ", xtkBalanceBefore.toString());

  if (fundAssets.length > 0) {
    apiUrl = `https://api.1inch.exchange/v3.0/1/swap?fromTokenAddress=${fundAssets[0]}&toTokenAddress=${xtkAddress}&amount=${feeBalances[0]}&fromAddress=${revenueControllerAddress}&slippage=0.5&disableEstimate=true`;
    response = await axios.get(apiUrl);
    calldata = response.data.tx.data;

    const claimAndSwapData: any[] = [];
    const callValue: any[] = [];
    for (let i = 0; i < fundAssets.length; i++) {
      claimAndSwapData[i] = [];
      callValue[i] = 0;
    }
    claimAndSwapData[0] = calldata;
    callValue[0] = fundAssets[0] === ETH_ADDRESS ? feeBalances[0] : 0;

    console.log("Calling claimAndSwap...");
    await revenueController.claimAndSwap(fundIndex, claimAndSwapData, callValue);
  }

  xtkBalanceAfter = await xtk.balanceOf(stakingModuleAddress);
  console.log("StakingModule XTK balance after swap: ", xtkBalanceAfter.toString());
  console.log("Total XTK swapped: ", xtkBalanceAfter.sub(xtkBalanceBefore).toString());

  console.log("Getting withdraw fees after claimAndSwap...");
  [fundAssets, feeBalances] = await xAsset.getWithdrawableFees();
  for (let i = 0; i < fundAssets.length; i++) {
    console.log(`${fundAssets[i]} <===> ${feeBalances[i]}`);
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
