import { task } from "hardhat/config";
import axios from "axios";

import { RevenueController, IxAAVE, IERC20 } from "../typechain";

import { CLAIM_AND_SWAP } from "./task-names";
import { Artifact } from "hardhat/types";

const REVENUE_CONTROLLER_PROXY_ADDRESS = "0x37310ee55D433E51530b3efE41990360D6dBCFC3";
const xAAVEaAddress = "0x80DC468671316E50D4E9023D3db38D3105c1C146";
const AAVE_ADDRESS = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";
const XTK_ADDRESS = "0x7f3edcdd180dbe4819bd98fee8929b5cedb3adeb";

task(CLAIM_AND_SWAP, "Claim and swap").setAction(async (args, { ethers, artifacts }) => {
  const revenueController = <RevenueController>(
    await ethers.getContractAt("RevenueController", REVENUE_CONTROLLER_PROXY_ADDRESS)
  );

  const fundIndex = await revenueController.getFundIndex(xAAVEaAddress);
  const stakingModuleAddress = await revenueController.managementStakingModule();
  const xAAVEa = <IxAAVE>await ethers.getContractAt("IxAAVE", xAAVEaAddress);
  const erc20Artifacts: Artifact = await artifacts.readArtifact("IERC20");
  const xtk = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, XTK_ADDRESS);

  const feeBalance = await xAAVEa.withdrawableAaveFees();
  const xtkAddress = await revenueController.xtk();

  const apiUrl = `https://api.1inch.io/v4.0/1/swap?fromTokenAddress=${AAVE_ADDRESS}&toTokenAddress=${xtkAddress}&amount=${feeBalance.toString()}&fromAddress=${REVENUE_CONTROLLER_PROXY_ADDRESS}&slippage=1&disableEstimate=true`;
  const {
    data: { tx },
  } = await axios.get(apiUrl);

  const beforeClaim = await xtk.balanceOf(stakingModuleAddress);
  const beforeClaimEth = await ethers.provider.getBalance(revenueController.address);

  await revenueController.claimAndSwap(fundIndex, [[], tx.data], [0, tx.value], {
    gasPrice: 50,
  });

  const afterClaim = await xtk.balanceOf(stakingModuleAddress);
  const afterClaimEth = await ethers.provider.getBalance(revenueController.address);

  console.log("Claimed AAVE: ", ethers.utils.formatEther(feeBalance));
  console.log("XTK amount claimed: ", ethers.utils.formatEther(afterClaim.sub(beforeClaim)));
  console.log("ETH claimed: ", ethers.utils.formatEther(afterClaimEth.sub(beforeClaimEth)));
});
