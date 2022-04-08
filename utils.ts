import { BigNumber } from "ethers";
import BigN from "bignumber.js";
import { queryTokenPrice, uniWethOsqthPool, uniWethUsdcPool } from "./web3";
import { quoterContract } from "./web3";
import { OSQTH_ADDRESS, WETH_ADDRESS } from "./constants";

export const getETHPrice = async (blockNumber: number): Promise<number> =>
  await queryTokenPrice(uniWethUsdcPool, 12, blockNumber);

export const getOSQTHPrice = async (blockNumber: number): Promise<number> =>
  await queryTokenPrice(uniWethOsqthPool, 0, blockNumber);

export const getSellQuote = async (
  amount: BigN,
  blockNumber: number
): Promise<BigNumber> => {
  const quotedAmountOut = await quoterContract.callStatic.quoteExactInputSingle(
    OSQTH_ADDRESS,
    WETH_ADDRESS,
    3000,
    amount.toFixed(0, 1).toString(),
    0,
    { blockTag: blockNumber }
  );
  return quotedAmountOut;
};

export const getSellOutQuote = async (
  amountOut: BigN,
  blockNumber: number
): Promise<BigNumber> => {
  const quotedAmountIn = await quoterContract.callStatic.quoteExactOutputSingle(
    OSQTH_ADDRESS,
    WETH_ADDRESS,
    3000,
    amountOut.toFixed(0, 1).toString(),
    0,
    { blockTag: blockNumber }
  );
  return quotedAmountIn;
};

export const getBuyQuote = async (
  amountOut: BigN,
  blockNumber: number
): Promise<BigNumber> => {
  const quotedAmountOut =
    await quoterContract.callStatic.quoteExactOutputSingle(
      WETH_ADDRESS,
      OSQTH_ADDRESS,
      3000,
      amountOut.toFixed(0, 1).toString(),
      0,
      { blockTag: blockNumber }
    );
  return quotedAmountOut;
};

// effective collateral ratio with buying of osqth to repay
export const getEffectiveCollateralRatio = async (
  _shortAmount: string | BigNumber | BigN,
  _collateralAmount: BigN | BigNumber,
  blockNumber: number
): Promise<BigN> => {
  const shortAmount = new BigN(_shortAmount.toString());
  const collateralAmount = new BigN(_collateralAmount.toString());
  const ethToSpend = new BigN(
    // buying defined amount of oSQTH for unknown eth amount
    (await getBuyQuote(shortAmount, blockNumber)).toString()
  );
  return collateralAmount.div(ethToSpend);
};

// effective collateral ratio with buying of osqth to repay
export const getCollateralRatio = async (
  _shortAmount: string | BigNumber | BigN,
  _collateralAmount: BigN | BigNumber,
  blockNumber: number
): Promise<BigN> => {
  const shortAmount = new BigN(_shortAmount.toString());
  const collateralAmount = new BigN(_collateralAmount.toString());
  const normShortAmount = shortAmount.times(
    new BigN(
      // buying defined amount of oSQTH for unknown eth amount
      (await getOSQTHPrice(blockNumber)).toString()
    )
  );
  return collateralAmount.div(normShortAmount);
};

export const getTotalValueUSDC = async (
  _shortAmount: BigNumber | BigN | string,
  _collateralAmount: BigNumber | BigN,
  blockNumber: number
): Promise<string> => {
  const shortAmount = new BigN(_shortAmount.toString());
  const collateralAmount = new BigN(_collateralAmount.toString());
  const ethToSpend = new BigN(
    (await getBuyQuote(shortAmount, blockNumber)).toString()
  );
  // eth price on block number
  const ethPrice = await getETHPrice(blockNumber);
  return collateralAmount.minus(ethToSpend).times(ethPrice).toFixed(0);
};
