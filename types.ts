import BigN from "bignumber.js";
import { BigNumber } from "ethers";

export interface VaultStatus {
  shortAmount: BigN;
  collateralAmount: BigN;
  blockNumber: number;
  totalValueUSDC: string;
  oSQTHETHPrice: number;
  oSQTHUSDCPrice: number;
  wethPrice: number;
  collateralRatio: BigN;
  prevCollateralRatio: BigN;
  effectiveCollateralRatio: BigN;
  timestamp: string;
  reason: string;
  currentImpliedFunding: number;
  normalizationFactor: number;
  twapOSQTHPrice: BigNumber;
  userInterest: string;
}

export type Conditional = (
  blockNumber: number,
  currentVaultStatus: VaultStatus
) => Promise<[boolean, string]>;

export interface TargetHedgeAuctionType {
  targetHedge: BigN;
  isSellingAuction: boolean;
}  

export interface RebaseResult {
  shortAmount: BigN;
  collateralAmount: BigN;
  twap: BigNumber;
  userInterest: BigN;
}
