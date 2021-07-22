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
  const mgmt = "0x314022E24ceD941781DC295682634B37Bd0d9cFc";
  const oneInchExchange = "0x11111112542D85B3EF69AE05771c2dCCff4fAa26";
  const xtokenmanager = "0xfA3CaAb19E6913b6aAbdda4E27ac413e96EaB0Ca";

  const RevenueController: ContractFactory = await ethers.getContractFactory("RevenueController");
  const revenueController: Contract = await upgrades.deployProxy(RevenueController, [
    mgmt,
    oneInchExchange,
    xtokenmanager,
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
