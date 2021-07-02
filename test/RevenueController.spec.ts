import hre, { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "@ethersproject/bignumber";
import { expect } from "chai";

import { RevenueController } from "../typechain";

describe("RevenueController Test", () => {
  let deployer: SignerWithAddress;
  let revenueController: RevenueController;

  let xtk: string;
  let mgmt: string;
  let oneInchExchange: string;
  let govOps: SignerWithAddress;

  let manager: SignerWithAddress;
  let manager2: SignerWithAddress;

  before(async () => {
    const signers: SignerWithAddress[] = await hre.ethers.getSigners();

    deployer = signers[0];
    xtk = "0x7F3EDcdD180Dbe4819Bd98FeE8929b5cEdB3AdEB";
    mgmt = signers[1].address;
    oneInchExchange = "0x11111254369792b2Ca5d084aB5eEA397cA8fa48B";
    govOps = signers[2];
    manager = signers[3];
    manager2 = signers[4];

    const revenueControllerArtifact = await ethers.getContractFactory("RevenueController");
    revenueController = <RevenueController>(
      await upgrades.deployProxy(revenueControllerArtifact, [xtk, mgmt, oneInchExchange, govOps.address])
    );

    await revenueController.connect(govOps).setManager(manager.address);
    await revenueController.connect(govOps).setManager2(manager2.address);
  });

  describe("owner functions", async () => {
    beforeEach(async () => {});

    it("should be initialized correctly", async () => {
      expect(await revenueController.xtk()).to.equal(xtk);
      expect(await revenueController.managementStakingModule()).to.equal(mgmt);
      expect(await revenueController.oneInchExchange()).to.equal(oneInchExchange);
    });

    it("should add fund", async () => {});
  });
});
