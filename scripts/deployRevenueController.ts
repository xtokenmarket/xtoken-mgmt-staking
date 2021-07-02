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
  const xtk = "";
  const mgmt = "";
  const oneInchExchange = "";
  const govOps = "";

  const RevenueController: ContractFactory = await ethers.getContractFactory("RevenueController");
  const revenueController: Contract = await upgrades.deployProxy(RevenueController, [
    xtk,
    mgmt,
    oneInchExchange,
    govOps,
  ]);
  await revenueController.deployed();

  console.log("RevenueController deployed to: ", revenueController.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
