import { ethers } from "ethers";
import BigNumber from "bignumber.js";
import {
  CONTROLLER_ADDRESS,
  OSQTH_ADDRESS,
  UNI_WETH_USDC_POOL_ADDRESS,
  UNI_WETH_OSQTH_POOL_ADDRESS,
  WETH_ADDRESS,
  CRAB_ADDRESS,
  QUOTER_ADDRESS,
  ORACLE_ADDRESS,
} from "./constants";
import erc20Abi from "human-standard-token-abi";
import { abi as QuoterABI } from "@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json";
import controllerAbi from "./abis/controller.json";
import poolAbi from "./abis/pool-abi.json";
import crabAbi from "./abis/crab.json";
import IOracleAbi from "./abis/ioracle.json";

export const provider = new ethers.providers.JsonRpcProvider(
  "http://localhost:8545"
);

export const esprovider = new ethers.providers.EtherscanProvider();
export const controller = new ethers.Contract(
  CONTROLLER_ADDRESS,
  controllerAbi,
  provider
);
export const token = new ethers.Contract(OSQTH_ADDRESS, erc20Abi, provider);
export const weth = new ethers.Contract(WETH_ADDRESS, erc20Abi, provider);
export const crab = new ethers.Contract(CRAB_ADDRESS, crabAbi, provider);
export const uniWethUsdcPool = new ethers.Contract(
  UNI_WETH_USDC_POOL_ADDRESS,
  poolAbi,
  provider
);
export const uniWethOsqthPool = new ethers.Contract(
  UNI_WETH_OSQTH_POOL_ADDRESS,
  poolAbi,
  provider
);

export const quoterContract = new ethers.Contract(
  QUOTER_ADDRESS,
  QuoterABI,
  provider
);

export const IOracle = new ethers.Contract(
  ORACLE_ADDRESS,
  IOracleAbi,
  provider
);

export const getPriceOfSqrtPriceX96 = (
  sqrtPriceX96: string,
  decDiff: number
) => {
  const sqrt = new BigNumber(sqrtPriceX96.toString());

  const tokenPrice0 = sqrt.pow(2).div(new BigNumber(2).pow(192)); //token0
  const tokenPrice1 = (2 ** 192 / parseInt(sqrtPriceX96) ** 2) * 10 ** decDiff; // WETH

  // console.log(tokenPrice1);
  // console.log(tokenPrice0.toString());
  return tokenPrice1;
};

export const queryTokenPrice = async (
  pool: ethers.Contract,
  decDiff: number,
  blockNumber: number = null
) => {
  if (!blockNumber) {
    blockNumber = await provider.getBlockNumber();
  }
  try {
    const results = await pool.slot0({ blockTag: blockNumber });
    const { sqrtPriceX96 } = results;

    return getPriceOfSqrtPriceX96(sqrtPriceX96, decDiff);
  } catch (err) {
    return null;
  }
};
