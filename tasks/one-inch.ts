import { task } from "hardhat/config";
import axios from "axios";

import { ONE_INCH } from "./task-names";

const REVENUE_CONTROLLER_PROXY_ADDRESS = "0x37310ee55D433E51530b3efE41990360D6dBCFC3";

task(ONE_INCH, "Generate 1Inch data")
  .addParam("from", "From token address")
  .addParam("to", "To token address")
  .addParam("amount", "amount")
  .setAction(async ({ from: fromToken, to: toToken, amount }) => {
    const apiUrl = `https://api.1inch.io/v4.0/1/swap?fromTokenAddress=${fromToken}&toTokenAddress=${toToken}&amount=${amount}&fromAddress=${REVENUE_CONTROLLER_PROXY_ADDRESS}&slippage=1&disableEstimate=true`;
    const {
      data: { tx },
    } = await axios.get(apiUrl);
    console.log("1Inch data: ", tx.data);
    console.log("1Inch call value: ", tx.value);
  });
