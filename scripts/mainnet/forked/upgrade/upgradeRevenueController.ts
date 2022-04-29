import { ethers } from "hardhat";
import { ProxyAdmin, RevenueController } from "typechain";

const XTK_ADDRESS = "0x7F3EDcdD180Dbe4819Bd98FeE8929b5cEdB3AdEB";
const OWNER_ADDRSS = "0x105Ed4E2980CC60A13DdF854c75133434D6b4074";
const PROXY_ADMIN_ADDRESS = "0x54FF0Bf514134A24D2795c554952E0ce1F47aC79";
const PROXY_ADDRSS = "0x37310ee55D433E51530b3efE41990360D6dBCFC3";

async function deployForked() {
  const [admin] = await ethers.getSigners();

  await ethers.provider.send("hardhat_impersonateAccount", [OWNER_ADDRSS]);
  const owner = await ethers.provider.getSigner(OWNER_ADDRSS);

  await admin.sendTransaction({
    to: OWNER_ADDRSS,
    value: ethers.utils.parseEther("10"),
  });

  const RevenueController = await ethers.getContractFactory("RevenueController");
  const revenueController = <RevenueController>await RevenueController.deploy();

  const proxyAdmin = <ProxyAdmin>await ethers.getContractAt("ProxyAdmin", PROXY_ADMIN_ADDRESS);
  await proxyAdmin.connect(owner).upgrade(PROXY_ADDRSS, revenueController.address);

  console.log("Proxy upgraded to new implementation: ", revenueController.address);
}

deployForked()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
