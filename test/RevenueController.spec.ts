import hre, { ethers } from "hardhat";
import { Artifact } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "ethers";
import { expect } from "chai";
import axios from "axios";

import { unlockAccount, getSnapShot, revertEvm, ZERO, MAX_UINT_256, ether, ETH_ADDRESS } from "./utils";
import { RevenueController, IxAsset, IERC20, IxINCH, ProxyAdmin } from "../typechain";

describe("RevenueController Test", () => {
  let deployer: SignerWithAddress;
  let xTokenDeployer: Signer;
  let multisig: Signer;
  let owner: Signer;

  let revenueController: RevenueController;
  let xINCHa: IxINCH;
  let inch: IERC20;
  let aave: IERC20;
  let xtk: IERC20;
  let proxyAdmin: ProxyAdmin;

  const oneInchV3 = "0x11111112542D85B3EF69AE05771c2dCCff4fAa26";
  const xTokenDeployerAddress = "0x38138586AedB29B436eAB16105b09c317F5a79dd";
  const multiSigAddress = "0x105Ed4E2980CC60A13DdF854c75133434D6b4074";
  const proxyAdminAddress = "0x54FF0Bf514134A24D2795c554952E0ce1F47aC79";
  const mgmt = "0x314022E24ceD941781DC295682634B37Bd0d9cFc";
  const ownerAddress = "0x4c0c29539c463af348f8cba8c02d644a8d68c320";

  const xtkAddress = "0x7F3EDcdD180Dbe4819Bd98FeE8929b5cEdB3AdEB";
  const xINCHaAddress = "0x8F6A193C8B3c949E1046f1547C3A3f0836944E4b";
  const xINCHbAddress = "0x6B33f15360cedBFB8F60539ec828ef52910acA9b";
  const inchAddress = "0x111111111117dC0aa78b770fA6A738034120C302";
  const xAAVEbAddress = "0x704De5696dF237c5B9ba0De9ba7e0C63dA8eA0Df";
  const aaveAddress = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";

  before(async () => {
    const signers: SignerWithAddress[] = await hre.ethers.getSigners();

    deployer = signers[0];

    await unlockAccount(multiSigAddress);
    multisig = await ethers.provider.getSigner(multiSigAddress);
    proxyAdmin = <ProxyAdmin>await ethers.getContractAt("ProxyAdmin", proxyAdminAddress);
    await deployer.sendTransaction({
      to: multiSigAddress,
      value: ether(10),
    });
    await unlockAccount(ownerAddress);
    owner = await ethers.provider.getSigner(ownerAddress);

    // deploy and initialize
    const RevenueController = await ethers.getContractFactory("RevenueController");
    revenueController = <RevenueController>await RevenueController.deploy();
    await proxyAdmin.connect(multisig).upgrade("0x37310ee55D433E51530b3efE41990360D6dBCFC3", revenueController.address);
    revenueController = <RevenueController>(
      await ethers.getContractAt("RevenueController", "0x37310ee55D433E51530b3efE41990360D6dBCFC3")
    );

    // xToken: transfer ownership from deploy to the RevenueController
    await unlockAccount(xTokenDeployerAddress);
    xTokenDeployer = await ethers.provider.getSigner(xTokenDeployerAddress);

    xINCHa = <IxINCH>await ethers.getContractAt("IxINCH", xINCHaAddress);

    await xINCHa.connect(xTokenDeployer).transferOwnership(revenueController.address);

    const erc20Artifacts: Artifact = await hre.artifacts.readArtifact("IERC20");
    inch = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, inchAddress);
    aave = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, aaveAddress);
    xtk = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, xtkAddress);
  });

  describe("owner functions", async () => {
    before(async () => {
      revenueController = revenueController.connect(deployer);
    });
    beforeEach(async () => {});

    it("should be initialized correctly", async () => {
      expect(await revenueController.xtk()).to.equal(xtk.address);
      expect(await revenueController.managementStakingModule()).to.equal(mgmt);
      expect(await revenueController.oneInchExchange()).to.equal(oneInchV3);
    });

    it("should add fund: xINCHa", async () => {
      await revenueController.connect(owner).addFund(xINCHaAddress, [ETH_ADDRESS, inchAddress]);
      expect(await revenueController.getFundIndex(xINCHaAddress)).to.equal(BigNumber.from(2));
      const inchFundAssets = await revenueController.getFundAssets(xINCHaAddress);
      expect(inchFundAssets[0]).to.equal(ETH_ADDRESS);
      expect(inchFundAssets[1]).to.equal(inchAddress);
    });

    it("should add fund: xINCHb", async () => {
      await revenueController.connect(owner).addFund(xINCHbAddress, [ETH_ADDRESS, inchAddress]);
      expect(await revenueController.getFundIndex(xINCHbAddress)).to.equal(BigNumber.from(3));
      const inchFundAssets = await revenueController.getFundAssets(xINCHbAddress);
      expect(inchFundAssets[0]).to.equal(ETH_ADDRESS);
      expect(inchFundAssets[1]).to.equal(inchAddress);
    });

    it("should add fund: xAAVEb", async () => {
      expect(await aave.allowance(revenueController.address, oneInchV3)).to.gt(ZERO);
      await revenueController.connect(owner).addFund(xAAVEbAddress, [ETH_ADDRESS, aaveAddress]);
      expect(await aave.allowance(revenueController.address, oneInchV3)).to.eq(MAX_UINT_256);
      expect(await revenueController.getFundIndex(xAAVEbAddress)).to.equal(BigNumber.from(4));
      const inchFundAssets = await revenueController.getFundAssets(xAAVEbAddress);
      expect(inchFundAssets[0]).to.equal(ETH_ADDRESS);
      expect(inchFundAssets[1]).to.equal(aaveAddress);
    });
  });

  describe("claimAndSwap", async () => {
    let feeBalance: BigNumber;
    let fundIndex: BigNumber;
    let apiUrl: string;
    let xAsset: IxAsset;
    let fundAsset: string;

    let snapshotID: any;

    beforeEach(async () => {
      snapshotID = await getSnapShot();
    });

    afterEach(async () => {
      await revertEvm(snapshotID);
    });

    async function subject1(): Promise<any> {
      fundIndex = await revenueController.getFundIndex(xAsset.address);
      apiUrl = `https://api.1inch.exchange/v3.0/1/swap?fromTokenAddress=${fundAsset}&toTokenAddress=${
        xtk.address
      }&amount=${feeBalance.toString()}&fromAddress=${revenueController.address}&slippage=1&disableEstimate=true`;
      const response = await axios.get(apiUrl);
      const calldata = response.data.tx.data;
      await revenueController.connect(deployer).claimAndSwap(fundIndex, [[], calldata], [0, 0]);
    }

    async function subject2(): Promise<any> {
      fundIndex = await revenueController.getFundIndex(xAsset.address);
      apiUrl = `https://api.1inch.exchange/v3.0/1/swap?fromTokenAddress=${fundAsset}&toTokenAddress=${
        xtk.address
      }&amount=${feeBalance.toString()}&fromAddress=${revenueController.address}&slippage=1&disableEstimate=true`;
      const response = await axios.get(apiUrl);
      const calldata = response.data.tx.data;
      await revenueController.connect(deployer).claimAndSwap(fundIndex, [calldata, []], [feeBalance, 0]);
    }

    it("should withdraw eth and inch from xINCHa, and swap all inch", async () => {
      xAsset = xINCHa;
      fundAsset = inch.address;
      feeBalance = await xINCHa.withdrawableOneInchFees();

      await subject1();

      expect(await xINCHa.withdrawableOneInchFees()).to.equal(ZERO);
      expect(await inch.balanceOf(revenueController.address)).to.equal(ZERO);
    });

    it("should withdraw eth and inch from xINCHa, and swap half inch", async () => {
      xAsset = xINCHa;
      fundAsset = inch.address;
      const withdrawable = await xINCHa.withdrawableOneInchFees();
      feeBalance = withdrawable.div(2);

      await subject1();

      expect(await xINCHa.withdrawableOneInchFees()).to.equal(ZERO);
      expect(await inch.balanceOf(revenueController.address)).to.equal(withdrawable.sub(feeBalance));
    });

    it("should withdraw eth and inch from xINCHa, and swap all eth", async () => {
      xAsset = xINCHa;
      fundAsset = ETH_ADDRESS;
      feeBalance = await ethers.provider.getBalance(xINCHa.address);

      await subject2();

      expect(await ethers.provider.getBalance(xINCHa.address)).to.equal(ZERO);
      expect(await ethers.provider.getBalance(revenueController.address)).to.equal(ZERO);
    });

    it("should withdraw eth and inch from xINCHa, and swap half eth", async () => {
      xAsset = xINCHa;
      fundAsset = ETH_ADDRESS;
      const ethBalance = await ethers.provider.getBalance(xINCHa.address);
      feeBalance = ethBalance.div(2);

      await subject2();

      expect(await ethers.provider.getBalance(xINCHa.address)).to.equal(ZERO);
      expect(await ethers.provider.getBalance(revenueController.address)).to.equal(ethBalance.sub(feeBalance));
    });
  });

  describe("swapOnceClaimed", async () => {
    let feeBalance: BigNumber;
    let fundIndex: BigNumber;
    let apiUrl: string;
    let xAsset: IxAsset;
    let fundAsset: string;

    let snapshotID: any;

    beforeEach(async () => {
      snapshotID = await getSnapShot();
    });

    afterEach(async () => {
      await revertEvm(snapshotID);
    });

    before(async () => {
      fundIndex = await revenueController.getFundIndex(xINCHa.address);
      await revenueController.connect(deployer).claimAndSwap(fundIndex, [[], []], [0, 0]);
    });

    it("swap all inch", async () => {
      xAsset = xINCHa;
      fundAsset = inch.address;
      feeBalance = await inch.balanceOf(revenueController.address);

      fundIndex = await revenueController.getFundIndex(xAsset.address);
      apiUrl = `https://api.1inch.exchange/v3.0/1/swap?fromTokenAddress=${fundAsset}&toTokenAddress=${
        xtk.address
      }&amount=${feeBalance.toString()}&fromAddress=${revenueController.address}&slippage=1&disableEstimate=true`;
      const response = await axios.get(apiUrl);
      const calldata = response.data.tx.data;

      await revenueController.connect(deployer).swapOnceClaimed(fundIndex, 1, calldata, 0);

      expect(await inch.balanceOf(revenueController.address)).to.equal(ZERO);
    });

    it("swap half eth", async () => {
      xAsset = xINCHa;
      fundAsset = ETH_ADDRESS;
      const ethBalance = await ethers.provider.getBalance(revenueController.address);
      feeBalance = ethBalance.div(2);

      fundIndex = await revenueController.getFundIndex(xAsset.address);
      apiUrl = `https://api.1inch.exchange/v3.0/1/swap?fromTokenAddress=${fundAsset}&toTokenAddress=${
        xtk.address
      }&amount=${feeBalance.toString()}&fromAddress=${revenueController.address}&slippage=1&disableEstimate=true`;
      const response = await axios.get(apiUrl);
      const calldata = response.data.tx.data;

      await revenueController.connect(deployer).swapOnceClaimed(fundIndex, 0, calldata, feeBalance);

      expect(await ethers.provider.getBalance(revenueController.address)).to.equal(ethBalance.sub(feeBalance));
    });
  });
});
