import { task } from "hardhat/config";
import axios from "axios";

import { RevenueController, IERC20 } from "../typechain";

import { SWAP_ORIGINATION_ETH } from "./task-names";
import { Artifact } from "hardhat/types";

const REVENUE_CONTROLLER_PROXY_ADDRESS = "0x37310ee55D433E51530b3efE41990360D6dBCFC3";
const XTK_ADDRESS = "0x7f3edcdd180dbe4819bd98fee8929b5cedb3adeb";
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

task(SWAP_ORIGINATION_ETH, "Claim & swap origination eth fees").setAction(async (args, { ethers, artifacts }) => {
  const revenueController = <RevenueController>(
    await ethers.getContractAt("RevenueController", REVENUE_CONTROLLER_PROXY_ADDRESS)
  );

  const stakingModuleAddress = await revenueController.managementStakingModule();
  const originationAddress = await revenueController.origination();

  const erc20Artifacts: Artifact = await artifacts.readArtifact("IERC20");
  const xtk = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, XTK_ADDRESS);

  const beforeClaim = await xtk.balanceOf(stakingModuleAddress);
  const beforeClaimEth = await ethers.provider.getBalance(originationAddress);

  const apiUrl = `https://api.1inch.io/v4.0/1/swap?fromTokenAddress=${ETH_ADDRESS}&toTokenAddress=${XTK_ADDRESS}&amount=${beforeClaimEth.toString()}&fromAddress=${REVENUE_CONTROLLER_PROXY_ADDRESS}&slippage=1&disableEstimate=true`;
  const {
    data: { tx },
  } = await axios.get(apiUrl);

  await (await revenueController.swapOriginationETH(tx.data, tx.value)).wait();

  const afterClaim = await xtk.balanceOf(stakingModuleAddress);
  const afterClaimEth = await ethers.provider.getBalance(originationAddress);

  console.log("XTK amount claimed: ", ethers.utils.formatEther(afterClaim.sub(beforeClaim)));
  console.log("ETH claimed: ", ethers.utils.formatEther(beforeClaimEth.sub(afterClaimEth)));
});
