import { task } from "hardhat/config";
import { ProxyAdmin, RevenueController } from "typechain";

import { UPGRADE_REVENUE_CONTROLLER } from "./task-names";

task(UPGRADE_REVENUE_CONTROLLER, "Upgrade Revenue Controller")
  .addParam("proxy", "Original proxy address")
  .addParam("admin", "Proxy Admin address")
  .setAction(async ({ proxy, admin: proxyAdminAddress }, { ethers, run, network }) => {
    console.log("Upgrading contract in: ", network.name);
    const RevenueController = await ethers.getContractFactory("RevenueController");
    const revenueController = <RevenueController>await RevenueController.deploy();
    await revenueController.deployed();

    const proxyAdmin = <ProxyAdmin>await ethers.getContractAt("ProxyAdmin", proxyAdminAddress);
    await proxyAdmin.upgrade(proxy, revenueController.address);

    console.log("Proxy upgraded to new implementation: ", revenueController.address);

    await run("verify:verify", {
      address: revenueController.address,
      constructorArguments: [],
    });
  });
