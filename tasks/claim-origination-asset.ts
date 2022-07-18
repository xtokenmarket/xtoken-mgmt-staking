import axios from "axios";
import { task } from "hardhat/config";
import { Artifact } from "hardhat/types";

import { RevenueController, IERC20 } from "../typechain";

import { CLAIM_ORIGINATION_ASSET } from "./task-names";

const REVENUE_CONTROLLER_PROXY_ADDRESS = "0x37310ee55D433E51530b3efE41990360D6dBCFC3";
const XTK_ADDRESS = "0x7f3edcdd180dbe4819bd98fee8929b5cedb3adeb";

task(CLAIM_ORIGINATION_ASSET, "Claim origination token")
  .addParam("token", "Token to claim")
  .setAction(async ({ token: tokenAddress }, { ethers, artifacts }) => {
    const revenueController = <RevenueController>(
      await ethers.getContractAt("RevenueController", REVENUE_CONTROLLER_PROXY_ADDRESS)
    );
    const stakingModuleAddress = await revenueController.managementStakingModule();
    const originationAddress = await revenueController.origination();

    const erc20Artifacts: Artifact = await artifacts.readArtifact("IERC20");
    const xtk = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, XTK_ADDRESS);
    const token = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, tokenAddress);

    const beforeClaim = await xtk.balanceOf(stakingModuleAddress);
    const feeBalance = await token.balanceOf(originationAddress);

    let oneInchData;
    let callValue;

    if (!feeBalance.isZero()) {
      const apiUrl = `https://api.1inch.io/v4.0/1/swap?fromTokenAddress=${tokenAddress}&toTokenAddress=${XTK_ADDRESS}&amount=${feeBalance.toString()}&fromAddress=${REVENUE_CONTROLLER_PROXY_ADDRESS}&slippage=1&disableEstimate=true`;
      const {
        data: { tx },
      } = await axios.get(apiUrl);
      oneInchData = tx.data;
      callValue = tx.value;
    } else {
      oneInchData = [];
      callValue = 0;
    }

    await (await revenueController.claimOriginationFeesAndSwap(tokenAddress, oneInchData, callValue)).wait();

    const afterClaim = await xtk.balanceOf(stakingModuleAddress);

    console.log("Claimed token: ", feeBalance.toString());
    console.log("XTK amount claimed: ", ethers.utils.formatEther(afterClaim.sub(beforeClaim)));
  });
