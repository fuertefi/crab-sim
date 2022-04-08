import { BigNumber } from "ethers";
import {
  OSQTH_ADDRESS,
  UNI_WETH_OSQTH_POOL_ADDRESS,
  WETH_ADDRESS,
} from "./constants";
import { IOracle } from "./web3";
import { Conditional, VaultStatus } from "./types";
import {
  getCollateralRatio,
  getETHPrice,
  getOSQTHPrice,
  getTotalValueUSDC,
} from "./utils";

export const opportunisticCollateralAndPerformance: Conditional = async (
  blockNumber: number,
  currentVaultStatus: VaultStatus
) => {
  const currentETHPrice = await getETHPrice(blockNumber);
  const currentOSQTHPrice = await getOSQTHPrice(blockNumber);
  const prevETHPrice = currentVaultStatus.wethPrice;
  const prevOSQTHPrice = currentVaultStatus.oSQTHETHPrice;

  const collateralRatio = await getCollateralRatio(
    currentVaultStatus.shortAmount,
    currentVaultStatus.collateralAmount,
    blockNumber
  );

  const totalValueUSDC = await getTotalValueUSDC(
    currentVaultStatus.shortAmount,
    currentVaultStatus.collateralAmount,
    blockNumber
  );

  if (currentETHPrice > prevETHPrice && currentOSQTHPrice <= prevOSQTHPrice) {
    return [true, "opportunistic price"];
  }

  if (collateralRatio.toNumber() <= 1.75) {
    return [true, `collateral less then 1.75: ${collateralRatio.toString()}`];
  }

  if (
    parseFloat(totalValueUSDC) / parseFloat(currentVaultStatus.totalValueUSDC) >
    1.07
  ) {
    return [
      true,
      `total value has grown by: ${
        (parseFloat(totalValueUSDC) /
          parseFloat(currentVaultStatus.totalValueUSDC)) *
        100
      }%`,
    ];
  }
  return [false, "no rebase"];
};

export const opportunisticCollateral175250: Conditional = async (
  blockNumber: number,
  currentVaultStatus: VaultStatus
) => {
  const currentETHPrice = await getETHPrice(blockNumber);
  const currentOSQTHPrice = await getOSQTHPrice(blockNumber);
  const prevETHPrice = currentVaultStatus.wethPrice;
  const prevOSQTHPrice = currentVaultStatus.oSQTHETHPrice;

  const collateralRatio = await getCollateralRatio(
    currentVaultStatus.shortAmount,
    currentVaultStatus.collateralAmount,
    blockNumber
  );

  if (currentETHPrice > prevETHPrice && currentOSQTHPrice <= prevOSQTHPrice) {
    return [true, "opportunistic price"];
  }

  if (collateralRatio.toNumber() <= 1.75) {
    return [true, `collateral less then 1.75: ${collateralRatio.toString()}`];
  }

  if (collateralRatio.toNumber() >= 2.5) {
    return [true, `collateral more then 2.5: ${collateralRatio.toString()}`];
  }

  return [false, "no rebase"];
};

export const opportunisticCollateral175235: Conditional = async (
  blockNumber: number,
  currentVaultStatus: VaultStatus
) => {
  const currentETHPrice = await getETHPrice(blockNumber);
  const currentOSQTHPrice = await getOSQTHPrice(blockNumber);
  const prevETHPrice = currentVaultStatus.wethPrice;
  const prevOSQTHPrice = currentVaultStatus.oSQTHETHPrice;

  const collateralRatio = await getCollateralRatio(
    currentVaultStatus.shortAmount,
    currentVaultStatus.collateralAmount,
    blockNumber
  );

  if (currentETHPrice > prevETHPrice && currentOSQTHPrice <= prevOSQTHPrice) {
    return [true, "opportunistic price"];
  }

  if (collateralRatio.toNumber() <= 1.75) {
    return [true, `collateral less then 1.75: ${collateralRatio.toString()}`];
  }

  if (collateralRatio.toNumber() >= 2.35) {
    return [true, `collateral more then 2.35: ${collateralRatio.toString()}`];
  }

  return [false, "no rebase"];
};

export const opportunisticTwapCollateral175235: Conditional = async (
  blockNumber: number,
  currentVaultStatus: VaultStatus
) => {
  const currentETHPrice = await getETHPrice(blockNumber);
  const currentOSQTHTwapPrice: BigNumber = await IOracle.getTwap(
    UNI_WETH_OSQTH_POOL_ADDRESS,
    OSQTH_ADDRESS,
    WETH_ADDRESS,
    420,
    true,
    { blockTag: blockNumber }
  );
  const prevETHPrice = currentVaultStatus.wethPrice;
  const prevOSQTHTwapPrice = currentVaultStatus.twapOSQTHPrice;

  const collateralRatio = await getCollateralRatio(
    currentVaultStatus.shortAmount,
    currentVaultStatus.collateralAmount,
    blockNumber
  );

  if (
    currentETHPrice > prevETHPrice &&
    currentOSQTHTwapPrice.lte(prevOSQTHTwapPrice)
  ) {
    return [true, "opportunistic price"];
  }

  if (collateralRatio.toNumber() <= 1.75) {
    return [true, `collateral less then 1.75: ${collateralRatio.toString()}`];
  }

  if (collateralRatio.toNumber() >= 2.35) {
    return [true, `collateral more then 2.35: ${collateralRatio.toString()}`];
  }

  return [false, "no rebase"];
};

export const opportunisticValueTwapCollateral175235: Conditional = async (
  blockNumber: number,
  currentVaultStatus: VaultStatus
) => {
  const currentETHPrice = await getETHPrice(blockNumber);
  const currentOSQTHTwapPrice: BigNumber = await IOracle.getTwap(
    UNI_WETH_OSQTH_POOL_ADDRESS,
    OSQTH_ADDRESS,
    WETH_ADDRESS,
    420,
    true,
    { blockTag: blockNumber }
  );
  const prevETHPrice = currentVaultStatus.wethPrice;
  const prevOSQTHTwapPrice = currentVaultStatus.twapOSQTHPrice;

  const collateralRatio = await getCollateralRatio(
    currentVaultStatus.shortAmount,
    currentVaultStatus.collateralAmount,
    blockNumber
  );

  if (
    currentETHPrice > prevETHPrice &&
    currentOSQTHTwapPrice.lte(prevOSQTHTwapPrice)
  ) {
    return [true, "opportunistic price"];
  }

  if (collateralRatio.toNumber() <= 1.75) {
    return [true, `collateral less then 1.75: ${collateralRatio.toString()}`];
  }

  if (collateralRatio.toNumber() >= 2.35) {
    return [true, `collateral more then 2.35: ${collateralRatio.toString()}`];
  }

  return [false, "no rebase"];
};

export const opportunisticGrowthCollateral175250: Conditional = async (
  blockNumber: number,
  currentVaultStatus: VaultStatus
) => {
  const currentETHPrice = await getETHPrice(blockNumber);
  const currentOSQTHPrice = await getOSQTHPrice(blockNumber);
  const prevETHPrice = currentVaultStatus.wethPrice;
  const prevOSQTHPrice = currentVaultStatus.oSQTHETHPrice;

  const collateralRatio = await getCollateralRatio(
    currentVaultStatus.shortAmount,
    currentVaultStatus.collateralAmount,
    blockNumber
  );

  if (currentETHPrice > prevETHPrice && currentOSQTHPrice <= prevOSQTHPrice) {
    return [true, "opportunistic price"];
  }

  if (
    currentETHPrice > prevETHPrice &&
    (currentOSQTHPrice / prevOSQTHPrice - 1) /
      (currentETHPrice / prevETHPrice - 1) <
      2
  ) {
    return [
      true,
      `opportunistic growth: ${currentETHPrice} ${prevETHPrice} ${currentOSQTHPrice} ${prevOSQTHPrice}`,
    ];
  }

  if (collateralRatio.toNumber() <= 1.75) {
    return [true, `collateral less then 1.75: ${collateralRatio.toString()}`];
  }

  if (collateralRatio.toNumber() >= 2.5) {
    return [true, `collateral more then 2.5: ${collateralRatio.toString()}`];
  }

  return [false, "no rebase"];
};

export const opportunisticGrowthCollateral175235: Conditional = async (
  blockNumber: number,
  currentVaultStatus: VaultStatus
) => {
  const currentETHPrice = await getETHPrice(blockNumber);
  const currentOSQTHPrice = await getOSQTHPrice(blockNumber);
  const prevETHPrice = currentVaultStatus.wethPrice;
  const prevOSQTHPrice = currentVaultStatus.oSQTHETHPrice;

  const collateralRatio = await getCollateralRatio(
    currentVaultStatus.shortAmount,
    currentVaultStatus.collateralAmount,
    blockNumber
  );

  if (currentETHPrice > prevETHPrice && currentOSQTHPrice <= prevOSQTHPrice) {
    return [true, "opportunistic price"];
  }

  if (
    currentETHPrice > prevETHPrice &&
    (currentOSQTHPrice / prevOSQTHPrice - 1) /
      (currentETHPrice / prevETHPrice - 1) <
      2
  ) {
    return [true, "opportunistic growth"];
  }

  if (collateralRatio.toNumber() <= 1.75) {
    return [true, `collateral less then 1.75: ${collateralRatio.toString()}`];
  }

  if (collateralRatio.toNumber() >= 2.35) {
    return [true, `collateral more then 2.35: ${collateralRatio.toString()}`];
  }

  return [false, "no rebase"];
};
