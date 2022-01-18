import { ethers } from "hardhat";
import { FlashbotsBundleProvider, FlashbotsBundleResolution } from "@flashbots/ethers-provider-bundle";
import { BigNumber } from "@ethersproject/bignumber";
import axios from "axios";

import { ETH_ADDRESS } from "./../../test/utils/constants";
import { RevenueController, IxU3LP, IERC20 } from "../../typechain";
import addresses from "./address.json";

// xtoken address
const revenueControllerAddress = addresses.revenueController;
const xtkAddress = addresses.xtk;
const stakingModuleAddress = addresses.stakingModule;

// target fund address
const fundAddress = addresses.xU3LPa;

// flashbots constants
const GWEI = BigNumber.from(10).pow(9);
const PRIORITY_FEE = GWEI.mul(3);
const BLOCKS_IN_THE_FUTURE = 1;
const MAX_BASE_GAS_FEE = GWEI.mul(107);
const MAX_GAS_FEE = MAX_BASE_GAS_FEE.add(PRIORITY_FEE);

async function main(): Promise<void> {
  // initialize the flashbots provider
  const authSigner = ethers.Wallet.createRandom();
  const [wallet] = await ethers.getSigners();
  const walletSigner = new ethers.Wallet("process.env.PRIVATE_KEY");
  const flashbotsProvider = await FlashbotsBundleProvider.create(ethers.provider, authSigner);

  // get the xtoken contracts
  console.log("Initiating contract instances...");
  const revenueController = <RevenueController>(
    await ethers.getContractAt("RevenueController", revenueControllerAddress)
  );
  const IxU3LP = <IxU3LP>await ethers.getContractAt("IxU3LP", fundAddress);
  const xtk = <IERC20>await ethers.getContractAt("IERC20", xtkAddress);

  // get the fund index
  console.log("Getting the fund index...");
  const fundIndex: BigNumber = await revenueController.getFundIndex(fundAddress);
  console.log("Fund Index: ", fundIndex.toString());

  let fundAssets: string[] = [addresses.dai, addresses.usdc];
  let feeBalances: BigNumber[] = [];

  console.log("Getting withdraw fees...");
  feeBalances[0] = await IxU3LP.withdrawableToken0Fees();
  console.log(`${fundAssets[0]} <===> ${feeBalances[0]}`);
  feeBalances[1] = await IxU3LP.withdrawableToken1Fees();
  console.log(`${fundAssets[1]} <===> ${feeBalances[1]}`);

  let apiUrl;
  let response;
  let calldata;
  let xtkBalanceBefore: BigNumber;
  let xtkBalanceAfter: BigNumber;

  xtkBalanceBefore = await xtk.balanceOf(stakingModuleAddress);
  console.log("StakingModule XTK balance before swap: ", xtkBalanceBefore.toString());

  // listen to every block that comes in
  ethers.provider.on("block", async blockNumber => {
    // get block
    const block = await ethers.provider.getBlock(blockNumber);
    const targetBlock = blockNumber + BLOCKS_IN_THE_FUTURE;
    // get an estimate for the max base fee of the target block (next block if BLOCKS_IN_THE_FUTURE is 1)
    const maxBaseFeeInFutureBlock = FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(
      BigNumber.from(block.baseFeePerGas),
      BLOCKS_IN_THE_FUTURE,
    );

    console.log("Max base fee of the target block", ethers.utils.formatUnits(maxBaseFeeInFutureBlock, 0));

    // If the max base fee + priority fee is less than our target max gas fee, then it's suitable to try sending tx
    if (maxBaseFeeInFutureBlock.add(PRIORITY_FEE) <= MAX_GAS_FEE) {
      console.log("Acceptable gas fee");

      // create 1inch request
      console.log("Creating 1inch request...");

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

      // Build the transaction
      console.log("Building the flashbots transaction...");

      const populatedTransaction = await revenueController.populateTransaction.swapOnceClaimed(
        fundIndex,
        1,
        claimAndSwapData[1],
        callValue[1],
        {
          type: 2,
          maxFeePerGas: MAX_BASE_GAS_FEE.add(PRIORITY_FEE),
          maxPriorityFeePerGas: PRIORITY_FEE,
          gasLimit: 500000,
          nonce: await ethers.provider.getTransactionCount(wallet.address),
        },
      );
      populatedTransaction.chainId = await wallet.getChainId();

      console.log("Creating the flashbots bundle...");

      // first sign the transaction (must be done with the walletSigner, regular wallet doesn't have signing)
      const signedPopulatedTransaction = await walletSigner.signTransaction(populatedTransaction);
      // Create the transaction bundle
      const transactionBundle = [
        {
          signedTransaction: signedPopulatedTransaction,
        },
      ];
      // Sign the bundle
      const signedTransaction = await flashbotsProvider.signBundle(transactionBundle);

      // Run the simulation
      console.log("Running the flashbots simulation...");

      const simulation = await flashbotsProvider.simulate(signedTransaction, targetBlock);
      if ("error" in simulation) {
        console.warn(`Simulation Error: ${simulation.error.message}`);
      } else {
        console.log(`Simulation Success: ${JSON.stringify(simulation, null, 2)}`);

        // send
        console.log("Sending the flashbots bundle");

        const bundleSubmission = await flashbotsProvider.sendRawBundle(signedTransaction, targetBlock);
        if ("error" in bundleSubmission) {
          throw new Error(bundleSubmission.error.message);
        }

        console.log("bundle submitted, waiting");
        const waitResponse = await bundleSubmission.wait();
        console.log(`Wait Response: ${FlashbotsBundleResolution[waitResponse]}`);

        if (waitResponse === FlashbotsBundleResolution.BundleIncluded) {
          xtkBalanceAfter = await xtk.balanceOf(stakingModuleAddress);
          console.log("StakingModule XTK balance after swap: ", xtkBalanceAfter.toString());
          console.log("Total XTK swapped: ", xtkBalanceAfter.sub(xtkBalanceBefore).toString());
          console.log("Getting withdraw fees after claimAndSwap...");
          feeBalances[0] = await IxU3LP.withdrawableToken0Fees();
          console.log(`${fundAssets[0]} <===> ${feeBalances[0]}`);
          feeBalances[1] = await IxU3LP.withdrawableToken1Fees();
          console.log(`${fundAssets[1]} <===> ${feeBalances[1]}`);
          process.exit(0);
        } else {
          console.log({
            bundleStats: await flashbotsProvider.getBundleStats(simulation.bundleHash, targetBlock),
            userStats: await flashbotsProvider.getUserStats(),
          });
        }
      }
    }
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main();
