import hre, { ethers } from "hardhat";
import { Artifact } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "ethers";
import { expect } from "chai";
import axios from "axios";

import { unlockAccount, getSnapShot, revertEvm, ZERO, MAX_UINT_256, ether, ETH_ADDRESS } from "./utils";
import { RevenueController, IxAsset, IERC20, ProxyAdmin, IxAAVE } from "../typechain";

async function getOneInchData(fromTokenAddress: string, toTokenAddress: string, amount: string, fromAddress: string) {
  const apiUrl = `https://api.1inch.io/v4.0/1/swap?fromTokenAddress=${fromTokenAddress}&toTokenAddress=${toTokenAddress}&amount=${amount}&fromAddress=${fromAddress}&slippage=1&disableEstimate=true`;
  const { data } = await axios.get(apiUrl);
  return data.tx;
}

describe("RevenueController Test", () => {
  let deployer: SignerWithAddress;
  let xTokenDeployer: Signer;
  let multisig: Signer;

  let revenueController: RevenueController;
  let xAAVEa: IxAAVE;
  let xAAVEb: IxAAVE;
  let inch: IERC20;
  let aave: IERC20;
  let xtk: IERC20;
  let citaDAO: IERC20;
  let pnyd: IERC20;
  let xyz: IERC20;
  let proxyAdmin: ProxyAdmin;

  const oneInchV4 = "0x1111111254fb6c44bAC0beD2854e76F90643097d";
  const xTokenDeployerAddress = "0x38138586AedB29B436eAB16105b09c317F5a79dd";
  const multiSigAddress = "0x105Ed4E2980CC60A13DdF854c75133434D6b4074";
  const proxyAdminAddress = "0x54FF0Bf514134A24D2795c554952E0ce1F47aC79";
  const mgmt = "0x314022E24ceD941781DC295682634B37Bd0d9cFc";

  const xtkAddress = "0x7F3EDcdD180Dbe4819Bd98FeE8929b5cEdB3AdEB";
  const inchAddress = "0x111111111117dC0aa78b770fA6A738034120C302";
  const xAAVEaAddress = "0x80DC468671316E50D4E9023D3db38D3105c1C146";
  const xAAVEbAddress = "0x704De5696dF237c5B9ba0De9ba7e0C63dA8eA0Df";
  const aaveAddress = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";
  const terminalAddress = "0x090559D58aAB8828C27eE7a7EAb18efD5bB90374";
  // TODO: update origination core address when deploying it to mainnet
  const originationAddress = "0xa3C15A2c8f5daA9B8eef4eb01c000F19743CCaC1";
  const revenueControllerProxyAddress = "0x37310ee55D433E51530b3efE41990360D6dBCFC3";
  const citaDAOAddress = "0x3541A5C1b04AdABA0B83F161747815cd7B1516bC";
  const pnydAddress = "0x71921C08586295b0B68e44A78a2DCA1E3f259721";
  const xyzAddress = "0x67F0ecD58a6287d5ec8CA92b6Fda836EDa9aE41F";

  async function getBalance(address: string) {
    return ethers.provider.getBalance(address);
  }

  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];

    await unlockAccount(multiSigAddress);
    multisig = await ethers.provider.getSigner(multiSigAddress);

    await deployer.sendTransaction({
      to: multiSigAddress,
      value: ether(10),
    });

    // xToken: transfer ownership from deploy to the RevenueController
    await unlockAccount(xTokenDeployerAddress);
    xTokenDeployer = await ethers.provider.getSigner(xTokenDeployerAddress);

    await deployer.sendTransaction({
      to: xTokenDeployerAddress,
      value: ether(10),
    });

    const RevenueController = await ethers.getContractFactory("RevenueController");
    revenueController = <RevenueController>await RevenueController.deploy();
    await revenueController.deployed();

    proxyAdmin = <ProxyAdmin>await ethers.getContractAt("ProxyAdmin", proxyAdminAddress);

    await proxyAdmin.connect(multisig).upgrade(revenueControllerProxyAddress, revenueController.address);
    revenueController = <RevenueController>(
      await ethers.getContractAt("RevenueController", revenueControllerProxyAddress)
    );
    await deployer.sendTransaction({
      to: revenueController.address,
      value: ether(10),
    });

    const erc20Artifacts: Artifact = await hre.artifacts.readArtifact("IERC20");
    inch = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, inchAddress);
    aave = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, aaveAddress);
    xtk = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, xtkAddress);
    citaDAO = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, citaDAOAddress);
    pnyd = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, pnydAddress);
    xyz = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, xyzAddress);

    xAAVEa = <IxAAVE>await ethers.getContractAt("IxAAVE", xAAVEaAddress);
    xAAVEb = <IxAAVE>await ethers.getContractAt("IxAAVE", xAAVEbAddress);

    await deployer.sendTransaction({
      to: xTokenDeployer.getAddress(),
      value: ether(10),
    });
  });

  describe("claimTerminalFeesAndSwap", () => {
    let snapshotID: any;

    beforeEach(async () => {
      snapshotID = await getSnapShot();
    });

    afterEach(async () => {
      await revertEvm(snapshotID);
    });

    it("should claim CitaDAO token", async () => {
      const knightBalance = await citaDAO.balanceOf(terminalAddress);
      const tx = await getOneInchData(citaDAOAddress, xtk.address, knightBalance.toString(), revenueController.address);
      const calldata = tx.data;
      await expect(
        revenueController.connect(xTokenDeployer).claimTerminalFeesAndSwap(citaDAOAddress, calldata, tx.value),
      )
        .to.emit(revenueController, "FeesClaimed")
        .emit(revenueController, "RevenueAccrued");
    });
  });

  xdescribe("claimOriginationFeesAndSwap", () => {
    let snapshotID: any;

    beforeEach(async () => {
      snapshotID = await getSnapShot();
    });

    afterEach(async () => {
      await revertEvm(snapshotID);
    });

    it("should claim XYZ token accrued in fees at Origination core address", async () => {
      expect(await xyz.balanceOf(revenueController.address)).to.eq(0);
      
      const xyzOriginationBalance = await xyz.balanceOf(originationAddress);
      const tx = await getOneInchData(xyzAddress, xtk.address, xyzOriginationBalance.toString(), revenueController.address);
      const calldata = tx.data;
      
      await expect(
        revenueController.connect(xTokenDeployer).claimOriginationFeesAndSwap(xyzAddress, calldata, tx.value)
        )
          .to.emit(revenueController, "FeesClaimed")
          .emit(revenueController, "RevenueAccrued");

      expect(await xyz.balanceOf(originationAddress)).to.eq(0);
    });    
  })

  xdescribe("swapOriginationETH", () => {
    let snapshotID: any;

    beforeEach(async () => {
      snapshotID = await getSnapShot();
    });

    afterEach(async () => {
      await revertEvm(snapshotID);
    });

    it("should swap Origination ETH to XTK and stake it", async () => {
      const originationBalance = await ethers.provider.getBalance(originationAddress);
      const tx = await getOneInchData(ETH_ADDRESS, xtk.address, originationBalance.toString(), revenueController.address);
      const calldata = tx.data;
      await expect(
        revenueController.connect(xTokenDeployer).swapOriginationETH(calldata, tx.value)
        ).to.emit(revenueController, "FeesClaimed")
        .emit(revenueController, "RevenueAccrued");
      expect(await ethers.provider.getBalance(originationAddress)).to.eq(0);
    });
  })

  describe("swapOnceClaimedTerminal", () => {
    let snapshotID: any;

    beforeEach(async () => {
      snapshotID = await getSnapShot();
    });

    afterEach(async () => {
      await revertEvm(snapshotID);
    });

    it("should successfully swap asset amount existent at revenue controller address", async () => {
      const revControllerPnydBalance = await pnyd.balanceOf(revenueController.address);
      const swapAmount = revControllerPnydBalance.div(10);

      const tx2 = await getOneInchData(pnydAddress, xtk.address, swapAmount.toString(), revenueController.address);

      await expect(
        revenueController
          .connect(xTokenDeployer)
          .swapAssetOnceClaimed(terminalAddress, pnydAddress, tx2.data, tx2.value),
      )
        .to.emit(revenueController, "FeesClaimed")
        .emit(revenueController, "RevenueAccrued");

      expect(await pnyd.balanceOf(revenueController.address)).to.eq(revControllerPnydBalance.sub(swapAmount));
    });
  });

  describe("swapTerminalETH", () => {
    let snapshotID: any;

    beforeEach(async () => {
      snapshotID = await getSnapShot();
    });

    afterEach(async () => {
      await revertEvm(snapshotID);
    });

    it("should work as expected", async () => {
      const terminalBalance = await ethers.provider.getBalance(terminalAddress);
      const tx = await getOneInchData(ETH_ADDRESS, xtk.address, terminalBalance.toString(), revenueController.address);
      const calldata = tx.data;
      await expect(revenueController.connect(xTokenDeployer).swapTerminalETH(calldata, tx.value))
        .to.emit(revenueController, "FeesClaimed")
        .emit(revenueController, "RevenueAccrued");
    });
  });

  describe("owner functions", async () => {
    before(async () => {
      revenueController = revenueController.connect(deployer);
    });
    beforeEach(async () => {});

    it("should be initialized correctly", async () => {
      expect(await revenueController.xtk()).to.equal(xtk.address);
      expect(await revenueController.managementStakingModule()).to.equal(mgmt);
      expect(await revenueController.AGGREGATION_ROUTER_V4()).to.equal(oneInchV4);
    });

    it("should add fund: xAAVEa if not added", async () => {
      const fundIndex = await revenueController.getFundIndex(xAAVEaAddress);
      if (fundIndex.gt(0)) {
        await expect(
          revenueController.connect(xTokenDeployer).addFund(xAAVEaAddress, [ETH_ADDRESS, aaveAddress]),
        ).to.be.revertedWith("Already added");
      } else {
        expect(await aave.allowance(revenueController.address, oneInchV4)).to.gt(ZERO);
        await revenueController.connect(xTokenDeployer).addFund(xAAVEaAddress, [ETH_ADDRESS, aaveAddress]);
        expect(await aave.allowance(revenueController.address, oneInchV4)).to.eq(MAX_UINT_256);
        expect(fundIndex).to.equal(BigNumber.from(4));
        const inchFundAssets = await revenueController.getFundAssets(xAAVEaAddress);
        expect(inchFundAssets[0]).to.equal(ETH_ADDRESS);
        expect(inchFundAssets[1]).to.equal(aaveAddress);
      }
    });

    it("should add fund: xAAVEb if not added", async () => {
      const fundIndex = await revenueController.getFundIndex(xAAVEbAddress);
      if (fundIndex.gt(0)) {
        await expect(
          revenueController.connect(xTokenDeployer).addFund(xAAVEbAddress, [ETH_ADDRESS, aaveAddress]),
        ).to.be.revertedWith("Already added");
      } else {
        expect(await aave.allowance(revenueController.address, oneInchV4)).to.gt(ZERO);
        await revenueController.connect(xTokenDeployer).addFund(xAAVEbAddress, [ETH_ADDRESS, aaveAddress]);
        expect(await aave.allowance(revenueController.address, oneInchV4)).to.eq(MAX_UINT_256);
        expect(fundIndex).to.equal(BigNumber.from(4));
        const inchFundAssets = await revenueController.getFundAssets(xAAVEbAddress);
        expect(inchFundAssets[0]).to.equal(ETH_ADDRESS);
        expect(inchFundAssets[1]).to.equal(aaveAddress);
      }
    });
  });

  describe("claimAndSwap", async () => {
    let feeBalance: BigNumber;
    let fundIndex: BigNumber;
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
      const tx = await getOneInchData(fundAsset, xtk.address, feeBalance.toString(), revenueController.address);
      await revenueController.connect(xTokenDeployer).claimAndSwap(fundIndex, [[], tx.data], [0, tx.value]);
    }

    async function subject2(): Promise<any> {
      fundIndex = await revenueController.getFundIndex(xAsset.address);
      const tx = await getOneInchData(fundAsset, xtk.address, feeBalance.toString(), revenueController.address);
      await revenueController.connect(xTokenDeployer).claimAndSwap(fundIndex, [tx.data, []], [tx.value, 0]);
    }

    it("should withdraw eth and aave from xAAVEa, and swap all aave", async () => {
      xAsset = xAAVEa;
      fundAsset = aave.address;
      feeBalance = await xAAVEa.withdrawableAaveFees();

      await subject1();

      expect(await xAAVEa.withdrawableAaveFees()).to.equal(ZERO);
      expect(await aave.balanceOf(revenueController.address)).to.equal(ZERO);
    });

    it("should withdraw eth and aave from xAAVEa, and swap half aave", async () => {
      xAsset = xAAVEa;
      fundAsset = aave.address;
      const withdrawable = await xAAVEa.withdrawableAaveFees();
      feeBalance = withdrawable.div(2);

      await subject1();

      expect(await xAAVEa.withdrawableAaveFees()).to.equal(ZERO);
      expect(await aave.balanceOf(revenueController.address)).to.equal(withdrawable.sub(feeBalance));
    });

    it("should withdraw eth and aave from xAAVEb, and swap all eth", async () => {
      xAsset = xAAVEb;
      fundAsset = ETH_ADDRESS;
      feeBalance = await getBalance(xAAVEb.address);
      const originalBalance = await getBalance(revenueController.address);

      await subject2();

      expect(await getBalance(xAAVEb.address)).to.equal(ZERO);
      expect(await getBalance(revenueController.address)).to.equal(originalBalance);
    });

    it("should withdraw eth and aave from xAAVEb, and swap half eth", async () => {
      xAsset = xAAVEb;
      fundAsset = ETH_ADDRESS;
      const ethBalance = await getBalance(xAAVEb.address);
      feeBalance = ethBalance.div(2);
      const originalBalance = await getBalance(revenueController.address);

      await subject2();

      expect(await getBalance(xAAVEb.address)).to.equal(ZERO);
      expect(await getBalance(revenueController.address)).to.equal(originalBalance.add(ethBalance).sub(feeBalance));
    });
  });

  describe("swapOnceClaimed", async () => {
    let feeBalance: BigNumber;
    let fundIndex: BigNumber;
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
      fundIndex = await revenueController.getFundIndex(xAAVEa.address);
      await revenueController.connect(xTokenDeployer).claimAndSwap(fundIndex, [[], []], [0, 0]);
    });

    it("swap all aave", async () => {
      xAsset = xAAVEa;
      fundAsset = aave.address;
      feeBalance = await aave.balanceOf(revenueController.address);

      fundIndex = await revenueController.getFundIndex(xAsset.address);
      const tx = await getOneInchData(fundAsset, xtk.address, feeBalance.toString(), revenueController.address);

      await revenueController.connect(xTokenDeployer).swapOnceClaimed(fundIndex, 1, tx.data, 0);

      expect(await inch.balanceOf(revenueController.address)).to.equal(ZERO);
    });

    it("swap half eth", async () => {
      xAsset = xAAVEa;
      fundAsset = ETH_ADDRESS;
      const ethBalance = await ethers.provider.getBalance(revenueController.address);
      feeBalance = ethBalance.div(2);

      fundIndex = await revenueController.getFundIndex(xAsset.address);
      const tx = await getOneInchData(fundAsset, xtk.address, feeBalance.toString(), revenueController.address);

      await revenueController.connect(xTokenDeployer).swapOnceClaimed(fundIndex, 0, tx.data, feeBalance);

      expect(await ethers.provider.getBalance(revenueController.address)).to.equal(ethBalance.sub(feeBalance));
    });
  });
});
