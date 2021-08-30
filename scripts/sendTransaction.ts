import { ethers } from "hardhat";

async function main(): Promise<void> {
  const [sender] = await ethers.getSigners();
  console.log("sender", sender.address);
  const txObject = await sender.sendTransaction({
    to: "",
    value: 0,
    data: "0x486f772061626f7574206b656570206120243530306b20626f756e747920616e642072657475726e2074686520726573743f20576527726520616c6c206275696c646572732068657265",
    maxPriorityFeePerGas: 2 * 10 ** 9,
  });
  console.log("txObject", txObject);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
