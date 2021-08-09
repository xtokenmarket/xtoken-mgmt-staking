import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@openzeppelin/hardhat-upgrades";
import "@nomiclabs/hardhat-etherscan";

import "./tasks/accounts";
import "./tasks/clean";

import { resolve } from "path";

import { config as dotenvConfig } from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

dotenvConfig({ path: resolve(__dirname, "./.env") });

const chainIds = {
  ganache: 1337,
  goerli: 5,
  hardhat: 31337,
  kovan: 42,
  mainnet: 1,
  rinkeby: 4,
  ropsten: 3,
};

let deployAccountKey: string;
if (!process.env.DEPLOY_ACCOUNT_KEY) {
  throw new Error("Please set your DEPLOY_ACCOUNT_KEY in a .env file");
} else {
  deployAccountKey = process.env.DEPLOY_ACCOUNT_KEY;
}

let alchemyapi: string;
if (!process.env.ALCHEMY_API_KEY) {
  throw new Error("Please set your ALCHEMY_API_KEY in a .env file");
} else {
  alchemyapi = process.env.ALCHEMY_API_KEY;
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  gasReporter: {
    currency: "USD",
    enabled: false,
    excludeContracts: [],
    src: "./contracts",
  },
  networks: {
    hardhat: {
      // accounts: [
      //   {
      //     privateKey: deployAccountKey,
      //     balance: "1000000000000000000000",
      //   },
      // ],
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${alchemyapi}`,
        blockNumber: 12968176,
      },
      hardfork: "london",
      gasPrice: "auto",
    },
    mainnet: {
      accounts: [deployAccountKey],
      gasPrice: 50 * 10 ** 9, // 40 Gwei
      chainId: chainIds.mainnet,
      url: `https://eth-mainnet.alchemyapi.io/v2/${alchemyapi}`,
      timeout: 200000,
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.4",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/solidity-template/issues/31
        bytecodeHash: "none",
      },
      // You should disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 800,
      },
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  mocha: {
    timeout: 200000,
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
};

export default config;
