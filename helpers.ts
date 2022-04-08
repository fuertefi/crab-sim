import path from "path";
import fs from "fs";
import { formatEther } from "ethers/lib/utils";
import { VaultStatus } from "./types";
import {
  getCollateralRatio,
  getETHPrice,
  getOSQTHPrice,
  getTotalValueUSDC,
} from "./utils";

export const clearLines = (n: number) => {
  for (let i = 0; i < n; i++) {
    //first clear the current line, then clear the previous line
    const y = i === 0 ? null : -1;
    process.stdout.moveCursor(0, y);
    process.stdout.clearLine(1);
  }
  process.stdout.cursorTo(0);
};

export const displayVaultStatus = async (
  currentVaultStatus: VaultStatus,
  blockNumber: number,
  startTime: number,
  blockToStart: number,
  blockToFinish: number
) => {
  const totalValueUSDC = await getTotalValueUSDC(
    currentVaultStatus.shortAmount,
    currentVaultStatus.collateralAmount,
    blockNumber
  );
  const collateralRatio = await getCollateralRatio(
    currentVaultStatus.shortAmount,
    currentVaultStatus.collateralAmount,
    blockNumber
  );

  const currentETHPrice = await getETHPrice(blockNumber);
  const currentOSQTHPrice = await getOSQTHPrice(blockNumber);

  const currentTime = Date.now();
  const msPassed = currentTime - startTime;

  const msLeft =
    ((blockToFinish - blockNumber) * msPassed) / (blockNumber - blockToStart);

  const minLeft = msLeft / 1000 / 60;

  process.stdout.write(`block number: ${blockNumber}\n`);
  process.stdout.write(
    `total value: ${formatEther(totalValueUSDC.toString())}\n`
  );
  process.stdout.write(`collateral ratio: ${collateralRatio}\n`);
  process.stdout.write(`current ETH price: ${currentETHPrice}\n`);
  process.stdout.write(`current OSQTH price: ${currentOSQTHPrice}\n`);
  process.stdout.write(`ETA min left: ${minLeft}`);
  clearLines(6);
};

export function ensureDirectoryExistence(filePath: string) {
  var dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}
