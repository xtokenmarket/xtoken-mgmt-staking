import { ethers } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import axios from "axios";

import { ETH_ADDRESS } from "../../test/utils";
import { RevenueController, IERC20 } from "../../typechain";
import addresses from "./address.json";

const revenueControllerAddress = addresses.revenueController;
const xtkAddress = addresses.xtk;
const stakingModuleAddress = addresses.stakingModule;

const fundAddress = addresses.xINCHa;
const fundAsset: any = addresses.inch;

async function main(): Promise<void> {
  console.log("Initiating contract instances...");
  const revenueController = <RevenueController>(
    await ethers.getContractAt("RevenueController", revenueControllerAddress)
  );

  const fundIndex: BigNumber = await revenueController.getFundIndex(fundAddress);
  const fundAssets: string[] = await revenueController.getFundAssets(fundAddress);
  const xtk = <IERC20>await ethers.getContractAt("IERC20", xtkAddress);

  let fundAssetIndex = -1;
  for (let i = 0; i < fundAssets.length; i++) {
    if (fundAsset === fundAssets[i]) {
      fundAssetIndex = i;
    }
  }

  if (fundAssetIndex === -1) {
    console.error("Wrong fund asset address");
    return;
  }

  let fundAssetFeeBalance = BigNumber.from(0);
  if (fundAsset === ETH_ADDRESS) {
    fundAssetFeeBalance = await ethers.provider.getBalance(revenueControllerAddress);
  } else {
    const erc20 = <IERC20>await ethers.getContractAt("IERC20", fundAsset);
    fundAssetFeeBalance = await erc20.balanceOf(revenueControllerAddress);
  }

  if (fundAssetFeeBalance.isZero()) {
    console.error("Fee balance is zero");
    return;
  }
  console.log("FundAssetFeeBalance before swap:", fundAssetFeeBalance.toString());

  // fundAssetFeeBalance = fundAssetFeeBalance.div(2); // swap half

  let apiUrl;
  let response;
  let calldata;
  let xtkBalanceBefore: BigNumber;
  let xtkBalanceAfter: BigNumber;

  xtkBalanceBefore = await xtk.balanceOf(stakingModuleAddress);
  console.log("StakingModule XTK balance before swap: ", xtkBalanceBefore.toString());

  apiUrl = `https://api.1inch.exchange/v3.0/1/swap?fromTokenAddress=${fundAsset}&toTokenAddress=${xtkAddress}&amount=${fundAssetFeeBalance}&fromAddress=${revenueControllerAddress}&slippage=1&disableEstimate=true`;
  response = await axios.get(apiUrl);
  calldata = response.data.tx.data;

  await revenueController.swapOnceClaimed(
    fundIndex,
    fundAssetIndex,
    calldata,
    fundAsset === ETH_ADDRESS ? fundAssetFeeBalance : 0,
    {
      // maxFeePerGas: BigNumberish | Promise<BigNumberish>,
      maxPriorityFeePerGas: 2 * 10 ** 9,
    },
  );

  xtkBalanceAfter = await xtk.balanceOf(stakingModuleAddress);
  console.log("StakingModule XTK balance after swap: ", xtkBalanceAfter.toString());

  if (fundAsset === ETH_ADDRESS) {
    fundAssetFeeBalance = await ethers.provider.getBalance(revenueControllerAddress);
  } else {
    const erc20 = <IERC20>await ethers.getContractAt("IERC20", fundAsset);
    fundAssetFeeBalance = await erc20.balanceOf(revenueControllerAddress);
  }
  console.log("FundAssetFeeBalance after swap:", fundAssetFeeBalance.toString());

  console.log("Total XTK swapped: ", xtkBalanceAfter.sub(xtkBalanceBefore).toString());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
