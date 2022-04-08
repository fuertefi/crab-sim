import path from "path";
import date from "date-and-time";
import {
  provider,
  queryTokenPrice,
  uniWethOsqthPool,
  uniWethUsdcPool,
  controller,
} from "./web3";
import { BigNumber } from "ethers";
import BigN from "bignumber.js";
import fs from "fs";
import { format } from "fast-csv";
import { formatEther, parseEther } from "ethers/lib/utils";
import {
  OSQTH_ADDRESS,
  UNI_WETH_OSQTH_POOL_ADDRESS,
  WETH_ADDRESS,
} from "./constants";
import {
  opportunisticCollateral175235,
  opportunisticCollateral175250,
  opportunisticCollateralAndPerformance,
  opportunisticGrowthCollateral175235,
  opportunisticGrowthCollateral175250,
  opportunisticTwapCollateral175235,
} from "./conditionals";
import { displayVaultStatus, ensureDirectoryExistence } from "./helpers";
import rebase from "./core";
import {
  getCollateralRatio,
  getEffectiveCollateralRatio,
  getETHPrice,
  getOSQTHPrice,
  getSellQuote,
  getTotalValueUSDC,
} from "./utils";
import { Conditional, VaultStatus } from "./types";
import { IOracle } from "./web3";
import { getCurrentImpliedFunding } from "./squeeth";

let blockToStart = 14011134;
//
const initialEth = parseEther("100");

const calculateETHtoBorrowFromUniswap = async (
  _ethDeposit: BigNumber,
  blockNumber: number
): Promise<{ ethToBorrow: BigN; initialWSqueethDebt: BigN }> => {
  const emptyState = new BigN(0);
  const ethDeposit = new BigN(_ethDeposit.toString());
  if (ethDeposit.eq(0))
    return { ethToBorrow: emptyState, initialWSqueethDebt: new BigN(0) };

  const oSQTHETHPrice = await queryTokenPrice(uniWethOsqthPool, 0, blockNumber);

  let start = new BigN("0.25");
  let end = new BigN("3");
  const deviation = new BigN("0.0001"); // .01 %
  let initialWSqueethDebt: BigN;

  let prevState = emptyState;
  while (start.lte(end)) {
    const middle = start.plus(end).div(2);
    const ethBorrow = ethDeposit.times(middle);
    initialWSqueethDebt = new BigN(
      ethBorrow
        .plus(ethDeposit)
        // .times(new BigN("2.84268140515556801954"))
        .times(new BigN(1).div(oSQTHETHPrice))
        .div(2)
        .toFixed(0)
    );
    const quote = new BigN(
      (await getSellQuote(initialWSqueethDebt, blockNumber)).toString()
    );
    const borrowRatio = quote.div(ethBorrow).minus(1);
    if (prevState.eq(quote)) {
      break;
    }
    prevState = ethBorrow;
    if (borrowRatio.gt(0) && borrowRatio.lte(deviation)) {
      break;
    } else {
      // If ratio matches check in first half or search in second half
      if (borrowRatio.gt(0)) {
        start = middle;
      } else {
        end = middle;
      }
    }
  }

  return { ethToBorrow: prevState, initialWSqueethDebt };
};

const getInitialVault = async (
  amount: BigNumber,
  blockNumber: number
): Promise<VaultStatus> => {
  const {
    ethToBorrow,
    initialWSqueethDebt,
  }: { ethToBorrow: BigN; initialWSqueethDebt: BigN } =
    await calculateETHtoBorrowFromUniswap(amount, blockNumber);

  const totalEth = ethToBorrow.plus(new BigN(amount.toString()));

  const effectiveCollateralRatio = await getEffectiveCollateralRatio(
    initialWSqueethDebt,
    totalEth,
    blockNumber
  );
  const collateralRatio = await getCollateralRatio(
    initialWSqueethDebt,
    totalEth,
    blockNumber
  );

  const totalValueUSDC = await getTotalValueUSDC(
    initialWSqueethDebt,
    totalEth,
    blockNumber
  );

  const currentBlock = await provider.getBlock(blockNumber);
  const wethPrice = await queryTokenPrice(uniWethUsdcPool, 12, blockNumber);
  const oSQTHETHPrice = await queryTokenPrice(uniWethOsqthPool, 0, blockNumber);

  const twapOSQTHPrice = await IOracle.getTwap(
    UNI_WETH_OSQTH_POOL_ADDRESS,
    OSQTH_ADDRESS,
    WETH_ADDRESS,
    420,
    true,
    { blockTag: blockNumber }
  );

  const initialVaultStatus: VaultStatus = {
    blockNumber,
    shortAmount: initialWSqueethDebt,
    collateralAmount: totalEth,
    effectiveCollateralRatio,
    collateralRatio,
    totalValueUSDC,
    wethPrice,
    oSQTHETHPrice,
    oSQTHUSDCPrice: oSQTHETHPrice * wethPrice,
    timestamp: new Date(currentBlock.timestamp * 1000).toUTCString(),
    prevCollateralRatio: new BigN(0),
    reason: "Initial",
    // expected normalization factor
    currentImpliedFunding: await getCurrentImpliedFunding(blockNumber),
    normalizationFactor: parseFloat(
      formatEther(
        (
          await controller.getExpectedNormalizationFactor({
            blockTag: blockNumber,
          })
        ).toString()
      )
    ),
    twapOSQTHPrice,
    userInterest: "-",
  };

  return initialVaultStatus;
};

class StratSim {
  deltaHedgeThreshold: number;
  conditional: Conditional;
  initialEth: BigNumber;
  vaultStatuses: VaultStatus[] = [];

  includeInterest: boolean;
  checkValue: boolean;
  name: string;
  csv: any;

  constructor(
    _name: string,
    _deltaHedgeThreshold: number,
    _conditional: Conditional,
    _includeInterest: boolean,
    _checkValue: boolean
  ) {
    this.name = _name;
    this.deltaHedgeThreshold = _deltaHedgeThreshold;
    this.conditional = _conditional;
    this.includeInterest = _includeInterest;
    this.checkValue = _checkValue;
  }

  async init(_initialEth: BigNumber, _blockNumber: number) {
    this.initialEth = _initialEth;
    const _vaultStatus = await getInitialVault(this.initialEth, _blockNumber);
    this.vaultStatuses = [_vaultStatus];

    const today = new Date();
    const filepath =
      "./output/" +
      date.format(today, "DD-MM-YY") +
      `/${this.name}_${_blockNumber}.csv`;
    ensureDirectoryExistence(filepath);
    const ws = fs.createWriteStream(filepath);

    this.csv = format({ headers: true });
    this.csv.pipe(ws).on("end", () => console.log("done"));

    const _st = {
      ..._vaultStatus,
      shortAmount: formatEther(_vaultStatus.shortAmount.toFixed(0, 1)),
      collateralAmount: formatEther(
        _vaultStatus.collateralAmount.toFixed(0, 1)
      ),
      totalValueUSDC: formatEther(_vaultStatus.totalValueUSDC),
      twapOSQTHPrice: formatEther(_vaultStatus.twapOSQTHPrice),
    };

    await this.csv.write(_st);
  }

  getCurrentVaultStatus(): VaultStatus {
    return this.vaultStatuses[this.vaultStatuses.length - 1];
  }

  async checkAndRebase(_blockNumber: number) {
    const currentVaultStatus = this.getCurrentVaultStatus();
    const conditional = await this.conditional(
      _blockNumber,
      currentVaultStatus
    );
    if (conditional[0]) {
      const _vaultStatus = await rebase(
        currentVaultStatus,
        this.deltaHedgeThreshold,
        _blockNumber,
        // conditional[1] === "opportunistic price" && this.includeInterest,
        this.includeInterest,
        conditional[1] === "opportunistic price" && this.checkValue
      );
      if (!_vaultStatus.shortAmount.eq(currentVaultStatus.shortAmount)) {
        this.vaultStatuses.push(_vaultStatus);

        const _st = {
          ..._vaultStatus,
          shortAmount: formatEther(_vaultStatus.shortAmount.toString()),
          collateralAmount: formatEther(
            _vaultStatus.collateralAmount.toString()
          ),
          totalValueUSDC: formatEther(_vaultStatus.totalValueUSDC),
          reason: conditional[1],
          currentImpliedFunding:
            (await getCurrentImpliedFunding(_blockNumber)) * 100,
          normalizationFactor: parseFloat(
            formatEther(
              (
                await controller.getExpectedNormalizationFactor({
                  blockTag: _blockNumber,
                })
              ).toString()
            )
          ),
          twapOSQTHPrice: formatEther(_vaultStatus.twapOSQTHPrice),
        };

        await this.csv.write(_st);
      }
    }
  }

  async finish(_blockNumber: number) {
    const currentBlock = await provider.getBlock(_blockNumber);
    const currentVaultStatus = this.getCurrentVaultStatus();

    const totalValueUSDC = await getTotalValueUSDC(
      currentVaultStatus.shortAmount,
      currentVaultStatus.collateralAmount,
      _blockNumber
    );
    const _st = {
      ...currentVaultStatus,
      blockNumber: _blockNumber,
      totalValueUSDC: formatEther(totalValueUSDC),
      oSQTHETHPrice: await getOSQTHPrice(_blockNumber),
      wethPrice: await getETHPrice(_blockNumber),
      timestamp: new Date(currentBlock.timestamp * 1000).toUTCString(),
      shortAmount: formatEther(currentVaultStatus.shortAmount.toString()),
      collateralAmount: formatEther(
        currentVaultStatus.collateralAmount.toString()
      ),
      twapOSQTHPrice: formatEther(currentVaultStatus.twapOSQTHPrice),
    };

    this.csv.write(_st);

    this.csv.end();
  }
}

const strats = [];

let startTime;

async function main() {
  let random = !!process.env.RANDOM;

  startTime = Date.now();
  // strats.push(
  // new StratSim(
  // "crab_5_perf_delta_2pct",
  // 0.02,
  // opportunisticCollateralAndPerformance
  // )
  // );
  // strats.push(
  // new StratSim(
  // "crab_5_perf_delta_3pct",
  // deltaHedgeThreshold,
  // opportunisticCollateralAndPerformance
  // )
  // );
  // strats.push(
  // new StratSim(
  // "crab_5_perf_delta_4pct",
  // 0.04,
  // opportunisticCollateralAndPerformance
  // )
  // );
  // strats.push(
  // new StratSim(
  // "crab_5_op_collat_175250_delta_2pct",
  // 0.02,
  // opportunisticCollateral175250
  // )
  // );
  // strats.push(
  // new StratSim(
  // "crab_5_op_collat_175250_delta_3pct",
  // 0.03,
  // opportunisticCollateral175250
  // )
  // );
  // strats.push(
  // new StratSim(
  // "crab_5_op_collat_175250_delta_4pct",
  // 0.04,
  // opportunisticCollateral175250
  // )
  // );
  // strats.push(
  // new StratSim(
  // "crab_5_op_collat_175235_delta_2pct",
  // 0.02,
  // opportunisticCollateral175235
  // )
  // );
  // strats.push(
  // new StratSim(
  // "crab_5_op_collat_175235_delta_3pct",
  // 0.03,
  // opportunisticCollateral175235
  // )
  // );
  // strats.push(
  // new StratSim(
  // "crab_5_op_collat_175235_delta_4pct",
  // 0.04,
  // opportunisticCollateral175235
  // )
  // );
  // strats.push(
  // new StratSim(
  // "crab_5_op_twap_collat_175235_delta_2pct",
  // 0.02,
  // opportunisticTwapCollateral175235
  // )
  // );
  strats.push(
    new StratSim(
      "crab_nointerest_no_value_check",
      0.03,
      opportunisticTwapCollateral175235,
      false,
      false
    )
  );
  strats.push(
    new StratSim(
      "crab_nointerest",
      0.03,
      opportunisticTwapCollateral175235,
      false,
      true
    )
  );
  strats.push(
    new StratSim(
      "crab_no_value_check",
      0.03,
      opportunisticTwapCollateral175235,
      true,
      false
    )
  );
  strats.push(
    new StratSim("crab", 0.03, opportunisticTwapCollateral175235, true, true)
  );
  // strats.push(
  // new StratSim(
  // "crab_5_op_twap_collat_175235_delta_4pct",
  // 0.04,
  // opportunisticTwapCollateral175235
  // )
  // );
  // strats.push(
  // new StratSim(
  // "crab_5_op_growth_collat_175236_delta_2pct",
  // 0.02,
  // opportunisticGrowthCollateral175236
  // )
  // );
  // strats.push(
  // new StratSim(
  // "crab_5_op_growth_collat_175236_delta_3pct",
  // 0.03,
  // opportunisticGrowthCollateral175236
  // )
  // );
  // strats.push(
  // new StratSim(
  // "crab_5_op_growth_collat_175236_delta_4pct",
  // 0.04,
  // opportunisticGrowthCollateral175236
  // )
  // );
  // strats.push(
  // new StratSim(
  // "crab_5_op_growth_collat_175250_delta_2pct",
  // 0.02,
  // opportunisticGrowthCollateral175250
  // )
  // );
  // strats.push(
  // new StratSim(
  // "crab_5_op_growth_collat_175250_delta_3pct",
  // 0.03,
  // opportunisticGrowthCollateral175250
  // )
  // );
  // strats.push(
  // new StratSim(
  // "crab_5_op_growth_collat_175250_delta_4pct",
  // 0.04,
  // opportunisticGrowthCollateral175250
  // )
  // );

  while (true) {
    if (random) {
      blockToStart += Math.floor(Math.random() * (14270000 - blockToStart));
    }

    // FIXME:
    const promises = strats.map((e) => e.init(initialEth, blockToStart));
    for await (const strat of promises) {
      // strat.init(initialEth, blockToStart);
    }

    let nextBlock = blockToStart + 1;
    let currentVaultStatus = strats[0].getCurrentVaultStatus();

    let blockToFinish = await provider.getBlockNumber();
    while (nextBlock < blockToFinish) {
      await displayVaultStatus(
        currentVaultStatus,
        nextBlock,
        startTime,
        blockToStart,
        blockToFinish
      );

      const _stratRebases = [];
      for (const strat of strats) {
        _stratRebases.push(strat.checkAndRebase(nextBlock));
      }
      await Promise.all(_stratRebases);
      currentVaultStatus = strats[0].getCurrentVaultStatus();
      nextBlock++;
    }
    for await (const strat of strats) {
      await strat.finish(nextBlock);
    }

    random = true;
    blockToFinish = await provider.getBlockNumber();
  }
}

main();
