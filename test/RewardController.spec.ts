import hre, { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "@ethersproject/bignumber";
import { expect } from "chai";

import { RewardController } from "../typechain";

describe("RewardController Test", () => {
  let deployer: SignerWithAddress;
  let rewardController: RewardController;

  let xtk: string;
  let mgmt: string;
  let govOps: SignerWithAddress;

  before(async () => {
    const signers: SignerWithAddress[] = await hre.ethers.getSigners();

    deployer = signers[0];
    xtk = "0x7F3EDcdD180Dbe4819Bd98FeE8929b5cEdB3AdEB";
    mgmt = signers[1].address;
    govOps = signers[2];

    const rewardControllerArtifact = await ethers.getContractFactory("RewardController");
    rewardController = <RewardController>(
      await upgrades.deployProxy(rewardControllerArtifact, [xtk, mgmt, govOps.address])
    );
  });

  describe("owner functions", async () => {
    beforeEach(async () => {});

    it("should be initialized correctly", async () => {
      expect(await rewardController.xtk()).to.equal(xtk);
      expect(await rewardController.managementStakingModule()).to.equal(mgmt);
    });

    it("should add fund", async () => {});
  });
});
