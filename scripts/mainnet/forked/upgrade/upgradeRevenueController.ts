import { ethers, artifacts } from "hardhat";
import { Artifact } from "hardhat/types";
import { IERC20, ProxyAdmin, RevenueController } from "typechain";
import axios from "axios";

const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const XTK_ADDRESS = "0x7F3EDcdD180Dbe4819Bd98FeE8929b5cEdB3AdEB";
const AAVE_ADDRESS = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";
const KNIGHT_ADDRESS = "0x3541A5C1b04AdABA0B83F161747815cd7B1516bC";

const MULTISIG_ADDRESS = "0x105Ed4E2980CC60A13DdF854c75133434D6b4074";
const XTOKEN_DEPLOYER_ADDRESS = "0x38138586AedB29B436eAB16105b09c317F5a79dd";

const PROXY_ADMIN_ADDRESS = "0x54FF0Bf514134A24D2795c554952E0ce1F47aC79";
const PROXY_ADDRSS = "0x37310ee55D433E51530b3efE41990360D6dBCFC3";

async function getOneInchData(fromTokenAddress: string, toTokenAddress: string, amount: string, fromAddress: string) {
  const apiUrl = `https://api.1inch.io/v4.0/1/swap?fromTokenAddress=${fromTokenAddress}&toTokenAddress=${toTokenAddress}&amount=${amount}&fromAddress=${fromAddress}&slippage=1&disableEstimate=true`;
  const { data } = await axios.get(apiUrl);
  return data.tx;
}

async function deployForked() {
  const [admin] = await ethers.getSigners();

  // Impersonate Multisig
  await ethers.provider.send("hardhat_impersonateAccount", [MULTISIG_ADDRESS]);
  const multisig = await ethers.provider.getSigner(MULTISIG_ADDRESS);

  await admin.sendTransaction({
    to: MULTISIG_ADDRESS,
    value: ethers.utils.parseEther("10"),
  });

  // Impersonate xToken Deployer
  await ethers.provider.send("hardhat_impersonateAccount", [XTOKEN_DEPLOYER_ADDRESS]);
  const xTokenDeployer = await ethers.provider.getSigner(XTOKEN_DEPLOYER_ADDRESS);

  await admin.sendTransaction({
    to: XTOKEN_DEPLOYER_ADDRESS,
    value: ethers.utils.parseEther("10"),
  });

  // Load ERC 20 Tokens

  const erc20Artifacts: Artifact = await artifacts.readArtifact("IERC20");
  const aave = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, AAVE_ADDRESS);
  const xtk = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, XTK_ADDRESS);
  const citaDAO = <IERC20>await ethers.getContractAt(erc20Artifacts.abi, KNIGHT_ADDRESS);

  const RevenueController = await ethers.getContractFactory("RevenueController");
  let revenueController = <RevenueController>await RevenueController.deploy();
  await revenueController.deployed();

  const proxyAdmin = <ProxyAdmin>await ethers.getContractAt("ProxyAdmin", PROXY_ADMIN_ADDRESS);
  await proxyAdmin.connect(multisig).upgrade(PROXY_ADDRSS, revenueController.address);

  console.log("Proxy upgraded to new implementation: ", revenueController.address);

  revenueController = <RevenueController>await ethers.getContractAt("RevenueController", PROXY_ADDRSS);
  const oneInchRouter = await revenueController.AGGREGATION_ROUTER_V4();
  const terminalAddress = await revenueController.terminal();
  const managementStakingModuleAddress = await revenueController.managementStakingModule();
  console.log("One Inch Exchange Router V4 address: ", oneInchRouter);
  console.log("Terminal address: ", terminalAddress);
  console.log("Management staking module address: ", managementStakingModuleAddress);

  /** Test claimTerminalFeesAndSwap() - withdraw KNIGHT */

  let terminalKnightBalance = await citaDAO.balanceOf(terminalAddress);
  let oldXtkBalance = await xtk.balanceOf(managementStakingModuleAddress);
  const terminalBalance = await ethers.provider.getBalance(terminalAddress);

  console.log("\n========  claimTerminalFeesAndSwap()  =========\n");
  console.log("Before claiming terminal KNIGHT token:");
  console.log("KNIGHT balance for Terminal: ", ethers.utils.formatEther(terminalKnightBalance));
  console.log("XTK balance for staking management module: ", ethers.utils.formatEther(oldXtkBalance));
  console.log("\n---------------------------------------------\n");

  let oneInchData = await getOneInchData(
    KNIGHT_ADDRESS,
    XTK_ADDRESS,
    terminalKnightBalance.toString(),
    revenueController.address,
  );

  await revenueController
    .connect(xTokenDeployer)
    .claimTerminalFeesAndSwap(KNIGHT_ADDRESS, oneInchData.data, oneInchData.value);
  terminalKnightBalance = await citaDAO.balanceOf(terminalAddress);
  let newXtkBalance = await xtk.balanceOf(managementStakingModuleAddress);

  console.log("After claiming terminal KNIGHT token:");
  console.log("KNIGHT balance for Terminal: ", ethers.utils.formatEther(terminalKnightBalance));
  console.log("XTK balance for staking management module: ", ethers.utils.formatEther(newXtkBalance));
  console.log("XTK amount claimed: ", ethers.utils.formatEther(newXtkBalance.sub(oldXtkBalance)));
  console.log("\n===============================================\n");

  /** Test swapTerminalETH() - after withdrawal of KNIGHT */
  console.log("\n========  swapTerminalETH()  =========\n");

  oldXtkBalance = await xtk.balanceOf(managementStakingModuleAddress);

  console.log("Before claiming terminal ETH:");
  console.log("XTK balance for staking management module: ", ethers.utils.formatEther(oldXtkBalance));
  console.log("ETH balance for terminal: ", ethers.utils.formatEther(terminalBalance));
  console.log("\n---------------------------------------------\n");

  oneInchData = await getOneInchData(ETH_ADDRESS, XTK_ADDRESS, terminalBalance.toString(), revenueController.address);
  await revenueController.connect(xTokenDeployer).swapTerminalETH(oneInchData.data, oneInchData.value);
  newXtkBalance = await xtk.balanceOf(managementStakingModuleAddress);
  const newTerminalETHBalance = await ethers.provider.getBalance(terminalAddress);

  console.log("After claiming terminal ETH:");
  console.log("XTK balance for staking management module: ", ethers.utils.formatEther(newXtkBalance));
  console.log("ETH balance for terminal: ", ethers.utils.formatEther(newTerminalETHBalance));
  console.log("XTK amount claimed: ", ethers.utils.formatEther(newXtkBalance.sub(oldXtkBalance)));
  console.log("\n===============================================\n");

  // Read state variables
  console.log("Next Fund Index: ", await revenueController.nextFundIndex());
  console.log("XTK: ", await revenueController.xtk());
  console.log("Management staking module address: ", await revenueController.managementStakingModule());
  console.log("1Inch exchange address for v3: ", await revenueController.oneInchExchange());
  console.log("xToken Manager: ", await revenueController.xtokenManager());
  console.log("Terminal address: ", await revenueController.terminal());
  console.log("Aggregation router v4: ", await revenueController.AGGREGATION_ROUTER_V4());
}

deployForked()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
