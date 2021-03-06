import { task } from "hardhat/config";
import axios from "axios";

import { RevenueController, IERC20 } from "../typechain";

import { SWAP_TERMINAL_ASSET } from "./task-names";
import { Artifact } from "hardhat/types";

const REVENUE_CONTROLLER_PROXY_ADDRESS = "0x37310ee55D433E51530b3efE41990360D6dBCFC3";

task(SWAP_TERMINAL_ASSET, "Swap token once claimed")
  .addParam("token", "Asset token address")
  .addParam("amount", "Amount of asset token swapped to XTK and staked")
  .setAction(async ({ token: tokenAddress, amount: assetAmount }, { ethers, artifacts }) => {
    const revenueController = <RevenueController>(
      await ethers.getContractAt("RevenueController", REVENUE_CONTROLLER_PROXY_ADDRESS)
    );
    const terminalAddress = await revenueController.terminal();

    const stakingModuleAddress = await revenueController.managementStakingModule();
    const erc20Artifacts: Artifact = await artifacts.readArtifact("IERC20");
    const xtkAddress = await revenueController.xtk();
    const xtk = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, xtkAddress);
    const assetToken = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, tokenAddress);

    const apiUrl = `https://api.1inch.io/v4.0/1/swap?fromTokenAddress=${tokenAddress}&toTokenAddress=${xtkAddress}&amount=${assetAmount}&fromAddress=${REVENUE_CONTROLLER_PROXY_ADDRESS}&slippage=1&disableEstimate=true`;
    const {
      data: { tx },
    } = await axios.get(apiUrl);

    const beforeClaimXtk = await xtk.balanceOf(stakingModuleAddress);
    const beforeClaimAsset = await assetToken.balanceOf(revenueController.address);

    await revenueController.swapAssetOnceClaimed(terminalAddress, tokenAddress, tx.data, tx.value);

    const afterClaimXtk = await xtk.balanceOf(stakingModuleAddress);
    const afterClaimAsset = await assetToken.balanceOf(revenueController.address);

    console.log("Claimed asset amount: ", beforeClaimAsset.sub(afterClaimAsset).toString());
    console.log("XTK amount staked: ", ethers.utils.formatEther(afterClaimXtk.sub(beforeClaimXtk)));
  });
