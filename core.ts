import { BigNumber } from "ethers";
import BigN from "bignumber.js";
import { IOracle, provider } from "./web3";
import {
  OSQTH_ADDRESS,
  UNI_WETH_OSQTH_POOL_ADDRESS,
  WETH_ADDRESS,
} from "./constants";
import {
  getBuyQuote,
  getCollateralRatio,
  getEffectiveCollateralRatio,
  getETHPrice,
  getOSQTHPrice,
  getSellOutQuote,
  // getSellQuote,
  getTotalValueUSDC,
} from "./utils";
import { VaultStatus, TargetHedgeAuctionType, RebaseResult } from "./types";

// returns wSqueeth amount in decimals
function getTargetHedgeAuctionType(
  wSqueethDelta: BigN,
  _ethDelta: BigNumber,
  _wSqueethEthPrice: BigNumber
): TargetHedgeAuctionType {
  const ethDelta = new BigN(_ethDelta.toString());
  const wSqueethEthPrice = new BigN(_wSqueethEthPrice.toString()).div(
    Math.pow(10, 18)
  );
  if (wSqueethDelta.gt(ethDelta)) {
    return {
      targetHedge: wSqueethDelta
        .minus(ethDelta)
        .div(wSqueethEthPrice)
        .div(Math.pow(10, 18)),
      isSellingAuction: false,
    };
  }
  return {
    targetHedge: ethDelta
      .minus(wSqueethDelta)
      .div(wSqueethEthPrice)
      .div(Math.pow(10, 18)),
    isSellingAuction: true,
  };
}

// 3200
// 0.34
//
// 3500
// 0.37
//
// 3300
// 0.37
//
// twap: 0.37
// 50 osqth to sell

function checkAuctionType(
  _shortAmount: BigN,
  collateralAmount: BigNumber,
  wSqueethPrice: BigNumber,
  deltaHedgeThreshold: number
): TargetHedgeAuctionType {
  let shortAmount = _shortAmount;
  if (typeof _shortAmount === "string") {
    shortAmount = new BigN(shortAmount);
  }
  const wSqueethDelta: BigN = shortAmount
    .times(2)
    .times(new BigN(wSqueethPrice.toString()).div(Math.pow(10, 18)));

  const { targetHedge, isSellingAuction } = getTargetHedgeAuctionType(
    wSqueethDelta,
    collateralAmount,
    wSqueethPrice
  );

  if (
    targetHedge
      .times(new BigN(wSqueethPrice.toString()))
      .div(new BigN(collateralAmount.toString()))
      .gt(deltaHedgeThreshold)
  ) {
  } else {
    return { targetHedge: new BigN(0), isSellingAuction: false };
  }

  return { isSellingAuction, targetHedge };
}

const _rebase = async (
  blockNumber: number,
  shortAmount: BigN,
  collateralAmount: BigN,
  deltaHedgeThreshold: number,
  includeInterest: boolean
): Promise<RebaseResult> => {
  let strategyDebt = undefined;
  let ethDelta = undefined;
  if (strategyDebt === undefined || parseFloat(strategyDebt.toString()) === 0) {
    strategyDebt = shortAmount;
  }
  if (ethDelta === undefined || parseFloat(ethDelta.toString()) === 0) {
    ethDelta = collateralAmount;
  }

  const twap = await IOracle.getTwap(
    UNI_WETH_OSQTH_POOL_ADDRESS,
    OSQTH_ADDRESS,
    WETH_ADDRESS,
    420,
    true,
    { blockTag: blockNumber }
  );

  // get osqth to buy or to sell
  const { isSellingAuction, targetHedge } = checkAuctionType(
    strategyDebt,
    ethDelta,
    twap,
    deltaHedgeThreshold
  );

  if (targetHedge.isEqualTo("0")) {
    return {
      shortAmount,
      collateralAmount,
      twap,
      userInterest: new BigN(0),
    };
  }

  const ethProceeds = targetHedge
    .times(new BigN(twap.toString()))
    .toFixed(0, 1);

  if (isSellingAuction) {
    // -eth, -osqth
    // took eth collateral
    // sold eth for osqth
    // repay osqth
    const sellQuote = await getSellOutQuote(new BigN(ethProceeds), blockNumber);

    if (includeInterest) {
      if (
        new BigN(sellQuote.toString()).div(Math.pow(10, 18)).lt(targetHedge)
      ) {
        const result = {
          shortAmount: new BigN(
            new BigN(strategyDebt.toString())
              .plus(targetHedge.times(Math.pow(10, 18)))
              .toFixed(0, 1)
          ),
          collateralAmount: new BigN(collateralAmount.toString()).plus(
            ethProceeds
          ),
          twap,
          userInterest: new BigN(sellQuote.toString())
            .minus(targetHedge)
            .div(Math.pow(10, 18)),
        };
        return result;
      }
      return {
        shortAmount,
        collateralAmount,
        twap,
        userInterest: new BigN(0),
      };
    }
    return {
      shortAmount: new BigN(
        new BigN(strategyDebt.toString())
          .plus(targetHedge.times(Math.pow(10, 18)))
          .toFixed(0, 1)
      ),
      collateralAmount: new BigN(collateralAmount.toString()).plus(ethProceeds),
      twap,
      userInterest: targetHedge.minus(
        new BigN(sellQuote.toString()).div(Math.pow(10, 18))
      ),
    };
  }

  // +eth, +osqth
  // issue oqsth
  // sold osqth for eth
  // add eth as collateral
  const buyQuote = await getBuyQuote(
    targetHedge.times(Math.pow(10, 18)),
    blockNumber
  );

  if (includeInterest) {
    if (new BigN(buyQuote.toString()).lt(ethProceeds)) {
      return {
        shortAmount: new BigN(
          new BigN(strategyDebt.toString())
            .minus(targetHedge.times(Math.pow(10, 18)))
            .toFixed(0, 1)
        ),
        collateralAmount: new BigN(collateralAmount.toString()).minus(
          ethProceeds
        ),
        twap,
        userInterest: new BigN(buyQuote.toString())
          .minus(ethProceeds)
          .div(Math.pow(10, 18)),
      };
    }
    return {
      shortAmount,
      collateralAmount,
      twap,
      userInterest: new BigN(0),
    };
  }
  return {
    shortAmount: new BigN(
      new BigN(strategyDebt.toString())
        .minus(targetHedge.times(Math.pow(10, 18)))
        .toFixed(0, 1)
    ),
    collateralAmount: new BigN(collateralAmount.toString()).minus(ethProceeds),
    twap,
    userInterest: new BigN(buyQuote.toString())
      .minus(ethProceeds)
      .div(Math.pow(10, 18)),
  };
};

const rebase = async (
  currentVaultStatus: VaultStatus,
  deltaHedgeThreshold: number,
  blockNumber: number,
  includeInterest: boolean,
  checkValue: boolean
) => {
  const preRebaseCollateralRatio = await getCollateralRatio(
    currentVaultStatus.shortAmount,
    currentVaultStatus.collateralAmount,
    blockNumber
  );
  const {
    shortAmount: _shortAmount,
    collateralAmount: _collateralAmount,
    twap: twapOSQTHPrice,
    userInterest,
  } = await _rebase(
    blockNumber + 1,
    currentVaultStatus.shortAmount,
    currentVaultStatus.collateralAmount,
    deltaHedgeThreshold,
    includeInterest
  );

  const _collateralRatio = await getCollateralRatio(
    _shortAmount,
    _collateralAmount,
    blockNumber
  );

  const _effectiveCollateralRatio = await getEffectiveCollateralRatio(
    _shortAmount,
    _collateralAmount,
    blockNumber
  );

  const totalValueUSDC = await getTotalValueUSDC(
    _shortAmount,
    _collateralAmount,
    blockNumber
  );

  if (
    checkValue &&
    parseInt(totalValueUSDC) < parseInt(currentVaultStatus.totalValueUSDC)
  ) {
    return currentVaultStatus;
  }

  const currentBlock = await provider.getBlock(blockNumber);

  const wethPrice = await getETHPrice(blockNumber);
  const oSQTHETHPrice = await getOSQTHPrice(blockNumber);

  const _vaultStatus: VaultStatus = {
    shortAmount: _shortAmount,
    collateralAmount: new BigN(_collateralAmount.toString()),
    collateralRatio: _collateralRatio,
    prevCollateralRatio: preRebaseCollateralRatio,
    effectiveCollateralRatio: _effectiveCollateralRatio,
    blockNumber,
    totalValueUSDC,
    oSQTHETHPrice,
    oSQTHUSDCPrice: wethPrice * oSQTHETHPrice,
    wethPrice,
    timestamp: new Date(currentBlock.timestamp * 1000).toUTCString(),
    reason: "",
    currentImpliedFunding: 0,
    normalizationFactor: 0,
    twapOSQTHPrice,
    userInterest: userInterest.toString(),
  };

  return _vaultStatus;
};

export default rebase;
