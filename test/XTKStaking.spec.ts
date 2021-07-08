import hre, { ethers, upgrades } from "hardhat";
import { Artifact } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "@ethersproject/bignumber";
import { expect } from "chai";
import { Signer } from "ethers";

import { XTKManagementStakingModule, IERC20 } from "../typechain";
import { unlockAccount, ether } from "./utils";

describe("XTKManagementStakingModule Test", () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let stakingModule: XTKManagementStakingModule;
  let whale: Signer;
  let xtk: IERC20;

  const xtkAddress = "0x7F3EDcdD180Dbe4819Bd98FeE8929b5cEdB3AdEB";
  const INITIAL_SUPPLY_MULTIPLIER = BigNumber.from(10);
  const penalty = ether(9).div(10).add(ether(5).div(100)); // 5%

  before(async () => {
    const signers: SignerWithAddress[] = await hre.ethers.getSigners();

    deployer = signers[0];
    alice = signers[2];
    bob = signers[3];

    const rewardControllerArtifact = await ethers.getContractFactory("XTKManagementStakingModule");
    stakingModule = <XTKManagementStakingModule>await upgrades.deployProxy(rewardControllerArtifact, [xtkAddress]);

    await unlockAccount("0xA0b5Eb5464fE4C5F4334a80267E784A961fdD865");
    whale = await ethers.provider.getSigner("0xA0b5Eb5464fE4C5F4334a80267E784A961fdD865");

    const erc20Artifacts: Artifact = await hre.artifacts.readArtifact("IERC20");
    xtk = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, xtkAddress);

    await xtk.connect(whale).transfer(alice.address, ether(100));
    await xtk.connect(whale).transfer(bob.address, ether(100));

    await xtk.connect(alice).approve(stakingModule.address, ether(100));
    await xtk.connect(bob).approve(stakingModule.address, ether(100));
  });

  describe("initialize", async () => {
    beforeEach(async () => {});

    it("should be initialized correctly", async () => {
      expect(await stakingModule.xtk()).to.equal(xtkAddress);
    });
  });

  describe("setUnstakePenalty", async () => {
    it("should revert from random address", async () => {
      await expect(stakingModule.connect(alice).setUnstakePenalty(ether(1))).to.be.revertedWith("");
    });

    it("should revert when > 1e18", async () => {
      await expect(stakingModule.connect(deployer).setUnstakePenalty(ether(2))).to.be.revertedWith(
        "Penalty outside range",
      );
    });

    it("should revert when < 1e17", async () => {
      await expect(stakingModule.connect(deployer).setUnstakePenalty(ether(1).div(10))).to.be.revertedWith(
        "Penalty outside range",
      );
    });

    it("should success with 9.5e17", async () => {
      await stakingModule.connect(deployer).setUnstakePenalty(penalty);
      expect(await stakingModule.unstakePenalty()).to.equal(penalty);
    });
  });

  describe("stake", async () => {
    it("alice stake 10xtk", async () => {
      await stakingModule.connect(alice).stake(ether(10));
      expect(await stakingModule.balanceOf(alice.address)).to.equal(ether(10).mul(INITIAL_SUPPLY_MULTIPLIER));
      expect(await stakingModule.totalSupply()).to.equal(ether(10).mul(INITIAL_SUPPLY_MULTIPLIER));
      expect(await xtk.balanceOf(stakingModule.address)).to.equal(ether(10));
    });

    it("bob stake 20xtk", async () => {
      await stakingModule.connect(bob).stake(ether(20));
      const bobMint = ether(20).mul(ether(100)).div(ether(10));
      expect(await stakingModule.balanceOf(bob.address)).to.equal(bobMint);
      expect(await stakingModule.totalSupply()).to.equal(ether(100).add(bobMint));
      expect(await xtk.balanceOf(stakingModule.address)).to.equal(ether(30));
    });
  });

  describe("unstake", async () => {
    let aliceMint = ether(100);
    let bobMint = ether(200);
    let totalMint = ether(300);
    let aliceXtk = ether(90);
    let bobXtk = ether(80);
    let stakingXtk = ether(30);

    before(async () => {
      await xtk.connect(whale).transfer(stakingModule.address, ether(100));
      stakingXtk = stakingXtk.add(ether(100));
    });

    it("alice unstake 100mint", async () => {
      const unstakeAmount = stakingXtk.mul(aliceMint).div(totalMint).mul(penalty).div(ether(1));
      console.log(unstakeAmount.toString());
      await stakingModule.connect(alice).unstake(aliceMint);
      totalMint = totalMint.sub(aliceMint);
      expect(await xtk.balanceOf(alice.address)).to.equal(aliceXtk.add(unstakeAmount));
    });
  });
});
