import BigN from "bignumber.js";
import { FUNDING_PERIOD, INDEX_SCALE, POOL_LIQUIDITY_ADDED } from "./constants";
import { controller, provider } from "./web3";

export const getCurrentImpliedFunding = async (blockNumber: number) => {
  if (blockNumber < POOL_LIQUIDITY_ADDED) {
    return null;
  }

  const currIndex = await getIndex(1, blockNumber);
  const currMark = await getMark(1, blockNumber);
  if (currIndex.isEqualTo(0)) {
    return 0;
  }

  return Math.log(currMark.dividedBy(currIndex).toNumber()) / FUNDING_PERIOD;
};

const getIndex = async (period: number, blockNumber: number = null) => {
  if (!blockNumber) {
    blockNumber = await provider.getBlockNumber();
  }

  const indexPrice = await controller.getIndex(period.toString(), {
    blockTag: blockNumber,
  });
  return new BigN(indexPrice.toString()).times(INDEX_SCALE).times(INDEX_SCALE);
};

const getMark = async (period: number, blockNumber: number = null) => {
  if (!controller) return new BigN(0);
  if (!blockNumber) {
    blockNumber = await provider.getBlockNumber();
  }

  const markPrice = await controller.getDenormalizedMark(period.toString(), {
    blockTag: blockNumber,
  });

  return new BigN(markPrice.toString()).times(INDEX_SCALE).times(INDEX_SCALE);
};
