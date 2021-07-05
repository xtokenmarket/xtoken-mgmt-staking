import hre, { ethers, upgrades } from "hardhat";
import { Artifact } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer, BytesLike } from "ethers";
import { expect } from "chai";
import axios from "axios";

import { unlockAccount } from "./utils";
import { RevenueController, IxAsset, IERC20 } from "../typechain";

describe("RevenueController Test", () => {
  let deployer: SignerWithAddress;
  let manager: SignerWithAddress;
  let manager2: SignerWithAddress;
  let govOps: SignerWithAddress;
  let xTokenDeployer: Signer;

  let revenueController: RevenueController;
  let xAAVEa: IxAsset;
  let xINCHa: IxAsset;
  let aave: IERC20;
  let inch: IERC20;
  let xtk: IERC20;

  let mgmt: string;

  // oneInchExchange = "0x11111254369792b2Ca5d084aB5eEA397cA8fa48B";
  const oneInchV3 = "0x11111112542D85B3EF69AE05771c2dCCff4fAa26";
  const xTokenDeployerAddress = "0x38138586AedB29B436eAB16105b09c317F5a79dd";

  const xtkAddress = "0x7F3EDcdD180Dbe4819Bd98FeE8929b5cEdB3AdEB";
  const xAAVEaAddress = "0x80DC468671316E50D4E9023D3db38D3105c1C146";
  const xINCHaAddress = "0x8F6A193C8B3c949E1046f1547C3A3f0836944E4b";
  const aaveAddress = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";
  const inchAddress = "0x111111111117dC0aa78b770fA6A738034120C302";

  before(async () => {
    const signers: SignerWithAddress[] = await hre.ethers.getSigners();

    deployer = signers[0];
    mgmt = signers[1].address;
    govOps = signers[2];
    manager = signers[3];
    manager2 = signers[4];

    // deploy and initialize
    const revenueControllerArtifact = await ethers.getContractFactory("RevenueController");
    revenueController = <RevenueController>(
      await upgrades.deployProxy(revenueControllerArtifact, [xtkAddress, mgmt, oneInchV3, govOps.address])
    );

    // set managers by govOps
    await revenueController.connect(govOps).setManager(manager.address);
    await revenueController.connect(govOps).setManager2(manager2.address);

    // xToken: transfer ownership from deploy to the RevenueController
    await unlockAccount(xTokenDeployerAddress);
    xTokenDeployer = await ethers.provider.getSigner(xTokenDeployerAddress);

    const xAssetArtifacts: Artifact = await hre.artifacts.readArtifact("IxAsset");
    xAAVEa = <IxAsset>await ethers.getContractAt(xAssetArtifacts.abi, xAAVEaAddress);
    xINCHa = <IxAsset>await ethers.getContractAt(xAssetArtifacts.abi, xINCHaAddress);

    await xAAVEa.connect(xTokenDeployer).transferOwnership(revenueController.address);
    await xINCHa.connect(xTokenDeployer).transferOwnership(revenueController.address);

    const erc20Artifacts: Artifact = await hre.artifacts.readArtifact("IERC20");
    aave = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, aaveAddress);
    inch = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, inchAddress);
    xtk = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, xtkAddress);
  });

  describe("owner functions", async () => {
    before(async () => {
      revenueController = revenueController.connect(govOps);
    });
    beforeEach(async () => {});

    it("should be initialized correctly", async () => {
      expect(await revenueController.xtk()).to.equal(xtk.address);
      expect(await revenueController.managementStakingModule()).to.equal(mgmt);
      expect(await revenueController.oneInchExchange()).to.equal(oneInchV3);
    });

    it("should add fund", async () => {
      await revenueController.addFund(xAAVEaAddress, [aaveAddress]);
      expect(await revenueController.getFundIndex(xAAVEaAddress)).to.equal(BigNumber.from(1));
      const aaveFundAssets = await revenueController.getFundAssets(xAAVEaAddress);
      expect(aaveFundAssets[0]).to.equal(aaveAddress);

      await revenueController.addFund(xINCHaAddress, [inchAddress]);
      expect(await revenueController.getFundIndex(xINCHaAddress)).to.equal(BigNumber.from(2));
      const inchFundAssets = await revenueController.getFundAssets(xINCHaAddress);
      expect(inchFundAssets[0]).to.equal(inchAddress);
    });
  });

  describe("claimAndSwap", async () => {
    it("claimAndSwap from xAAVEa", async () => {
      const aaveFeeBalance = await aave.balanceOf(xAAVEa.address);
      const fundIndex = await revenueController.getFundIndex(xAAVEa.address);
      const url = `https://api.1inch.exchange/v3.0/1/swap?fromTokenAddress=${aaveAddress}&toTokenAddress=${
        xtk.address
      }&amount=${aaveFeeBalance.div(2).toString()}&fromAddress=${
        revenueController.address
      }&slippage=1&disableEstimate=true`;
      const response = await axios.get(url);
      const calldata = response.data.tx.data;

      await revenueController.connect(manager).claimAndSwap(fundIndex, [calldata]);
      console.log((await xtk.balanceOf(mgmt)).toString());
    });

    it("claimAndSwap from xINCHa", async () => {
      const inchFeeBalance = await inch.balanceOf(xINCHa.address);
      const fundIndex = await revenueController.getFundIndex(xINCHa.address);
      const url = `https://api.1inch.exchange/v3.0/1/swap?fromTokenAddress=${inchAddress}&toTokenAddress=${
        xtk.address
      }&amount=${inchFeeBalance.div(2).toString()}&fromAddress=${
        revenueController.address
      }&slippage=1&disableEstimate=true`;

      const response = await axios.get(url);
      const calldata = response.data.tx.data;

      await revenueController.connect(manager).claimAndSwap(fundIndex, [calldata]);
      console.log((await xtk.balanceOf(mgmt)).toString());
    });
  });
});
