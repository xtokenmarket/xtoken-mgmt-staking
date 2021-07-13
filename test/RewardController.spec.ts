import hre, { ethers, upgrades } from "hardhat";
import { Artifact } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "@ethersproject/bignumber";
import { expect } from "chai";
import { Signer } from "ethers";

import { RewardController, IERC20 } from "../typechain";
import { unlockAccount, increaseTime, getTimeStamp, ZERO, ether } from "./utils";

describe("RewardController Test", () => {
  let deployer: SignerWithAddress;

  let rewardController: RewardController;
  let mgmt: string;
  let whale: Signer;
  let xtk: IERC20;

  const xtkAddress = "0x7F3EDcdD180Dbe4819Bd98FeE8929b5cEdB3AdEB";

  before(async () => {
    const signers: SignerWithAddress[] = await hre.ethers.getSigners();

    deployer = signers[0];
    mgmt = signers[1].address;

    const rewardControllerArtifact = await ethers.getContractFactory("RewardController");
    rewardController = <RewardController>await upgrades.deployProxy(rewardControllerArtifact, [xtkAddress, mgmt]);

    await unlockAccount("0xA0b5Eb5464fE4C5F4334a80267E784A961fdD865");
    whale = await ethers.provider.getSigner("0xA0b5Eb5464fE4C5F4334a80267E784A961fdD865");

    const erc20Artifacts: Artifact = await hre.artifacts.readArtifact("IERC20");
    xtk = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, xtkAddress);
  });

  describe("initialize", async () => {
    beforeEach(async () => {});

    it("should be initialized correctly", async () => {
      expect(await rewardController.xtk()).to.equal(xtkAddress);
      expect(await rewardController.managementStakingModule()).to.equal(mgmt);
    });
  });

  describe("initRewardDurationAndAmount", async () => {
    let rewardDuration: BigNumber;
    let rewardPeriodAmount: BigNumber;

    beforeEach(() => {
      rewardDuration = BigNumber.from(100);
      rewardPeriodAmount = ether(1000);
    });

    async function subject(): Promise<any> {
      await rewardController.connect(deployer).initRewardDurationAndAmount(rewardDuration, rewardPeriodAmount);
    }

    it("should revert when rewardDuration = 0", async () => {
      rewardDuration = ZERO;
      await expect(subject()).to.be.revertedWith("Invalid reward duration");
    });

    it("should revert when rewardPeriodAmount = 0", async () => {
      rewardPeriodAmount = ZERO;
      await expect(subject()).to.be.revertedWith("Invalid reward amount");
    });

    it("should revert when remainder exits = 0", async () => {
      rewardPeriodAmount = BigNumber.from(10);
      await expect(subject()).to.be.revertedWith("Amount not multiple of duration");
    });

    it("should revert when exceeds balance", async () => {
      await expect(subject()).to.be.revertedWith("Reward amount exceeds balance");
    });

    it("should success", async () => {
      await xtk.connect(whale).transfer(rewardController.address, rewardPeriodAmount);

      expect(await rewardController.lastUpdateTime()).to.equal(ZERO);
      expect(await rewardController.periodFinish()).to.equal(ZERO);

      await subject();

      expect(await rewardController.lastUpdateTime()).to.not.equal(ZERO);
      expect(await rewardController.periodFinish()).to.not.equal(ZERO);
    });

    it("should revert while reward ongoing", async () => {
      await expect(subject()).to.be.revertedWith("Cannot initiate period while reward ongoing");
    });
  });

  describe("releaseReward", async () => {
    it("should release half of reward", async () => {
      const lastUpdateTime = await rewardController.lastUpdateTime();
      const now = await getTimeStamp();
      await increaseTime(lastUpdateTime.toNumber() + BigNumber.from(50).toNumber() - now - 1);
      await rewardController.releaseReward();

      expect(await xtk.balanceOf(mgmt)).to.equal(ether(500));
      expect(await xtk.balanceOf(rewardController.address)).to.equal(ether(500));
    });

    it("should release 70%", async () => {
      const lastUpdateTime = await rewardController.lastUpdateTime();
      const now = await getTimeStamp();
      await increaseTime(lastUpdateTime.toNumber() + BigNumber.from(20).toNumber() - now - 1);
      await rewardController.releaseReward();

      expect(await xtk.balanceOf(mgmt)).to.equal(ether(700));
      expect(await xtk.balanceOf(rewardController.address)).to.equal(ether(300));
    });

    it("should release 100%", async () => {
      const lastUpdateTime = await rewardController.lastUpdateTime();
      const now = await getTimeStamp();
      await increaseTime(lastUpdateTime.toNumber() + BigNumber.from(100).toNumber() - now - 1);
      await rewardController.releaseReward();

      expect(await xtk.balanceOf(mgmt)).to.equal(ether(1000));
      expect(await xtk.balanceOf(rewardController.address)).to.equal(ether(0));
    });
  });
});
