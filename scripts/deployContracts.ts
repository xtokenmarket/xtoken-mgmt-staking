import { Contract, ContractFactory } from "ethers";
// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from "hardhat";

async function main(): Promise<void> {
  // Hardhat always runs the compile task when running scripts through it.
  // If this runs in a standalone fashion you may want to call compile manually
  // to make sure everything is compiled
  // await run("compile");

  // We get the contract to deploy
  const xtk = "0x7F3EDcdD180Dbe4819Bd98FeE8929b5cEdB3AdEB";
  const oneInchExchange = "0x11111112542D85B3EF69AE05771c2dCCff4fAa26";

  const XTKManagementStakingModule: ContractFactory = await ethers.getContractFactory("XTKManagementStakingModule");
  const xTKManagementStakingModule: Contract = await upgrades.deployProxy(XTKManagementStakingModule, [xtk]);
  await xTKManagementStakingModule.deployed();

  console.log("XTKManagementStakingModule deployed to: ", xTKManagementStakingModule.address);

  const RevenueController: ContractFactory = await ethers.getContractFactory("RevenueController");
  const revenueController: Contract = await upgrades.deployProxy(RevenueController, [
    xtk,
    xTKManagementStakingModule.address,
    oneInchExchange,
  ]);
  await revenueController.deployed();

  console.log("RevenueController deployed to: ", revenueController.address);

  const RewardController: ContractFactory = await ethers.getContractFactory("RewardController");
  const rewardController: Contract = await upgrades.deployProxy(RewardController, [
    xtk,
    xTKManagementStakingModule.address,
  ]);
  await rewardController.deployed();

  console.log("RewardController deployed to: ", rewardController.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
