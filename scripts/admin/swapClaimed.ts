import hre, { ethers } from "hardhat";
import { Artifact } from "hardhat/types";
import { BigNumber } from "@ethersproject/bignumber";
import axios from "axios";

import { ETH_ADDRESS } from "../../test/utils";
import { RevenueController, IERC20 } from "../../typechain";

const revenueControllerAddress = "0x37310ee55D433E51530b3efE41990360D6dBCFC3";
const xtkAddress = "0x7F3EDcdD180Dbe4819Bd98FeE8929b5cEdB3AdEB";

const fundAddress = "0x704De5696dF237c5B9ba0De9ba7e0C63dA8eA0Df"; // xAAVEb
const fundAsset: any = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";

async function main(): Promise<void> {
  const rcArtifacts: Artifact = await hre.artifacts.readArtifact("RevenueController");
  const revenueController = <RevenueController>await ethers.getContractAt(rcArtifacts.abi, revenueControllerAddress);

  const fundIndex: BigNumber = await revenueController.getFundIndex(fundAddress);
  const fundAssets: string[] = await revenueController.getFundAssets(fundAddress);

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
    const erc20Artifacts: Artifact = await hre.artifacts.readArtifact("IERC20");
    const erc20 = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, fundAsset);
    fundAssetFeeBalance = await erc20.balanceOf(revenueControllerAddress);
  }

  if (fundAssetFeeBalance.isZero()) {
    console.error("Fee balance is zero");
    return;
  }

  let apiUrl;
  let response;
  let calldata;

  apiUrl = `https://api.1inch.exchange/v3.0/1/swap?fromTokenAddress=${fundAsset}&toTokenAddress=${xtkAddress}&amount=${fundAssetFeeBalance}&fromAddress=${revenueControllerAddress}&slippage=1&disableEstimate=true`;
  response = await axios.get(apiUrl);
  calldata = response.data.tx.data;

  await revenueController.swapOnceClaimed(fundIndex, fundAssetIndex, calldata);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
