"use client";

import { request } from "@stacks/connect";

export interface PolicyInput {
  /** 0–100, as shown in the UI. */
  maxRiskScore: number;
  /** e.g. 1.30 */
  minHealthFactor: number;
  /** percent, 0–100 */
  maxProtocolConcentration: number;
  /** percent, 0–100 */
  minLiquidityScore: number;
}

/**
 * Clarity has no floats, so every threshold crosses the boundary as an integer:
 * percentages in basis points, the health factor scaled by 10,000. These must
 * match `risk-policy.clar` exactly or the contract stores the wrong limits.
 */
export function toContractArgs(input: PolicyInput): string[] {
  return [
    `u${Math.round(input.maxRiskScore * 100)}`,
    `u${Math.round(input.minHealthFactor * 10_000)}`,
    `u${Math.round(input.maxProtocolConcentration * 100)}`,
    `u${Math.round(input.minLiquidityScore * 100)}`,
  ];
}

export function validate(input: PolicyInput): string | null {
  if (input.maxRiskScore < 0 || input.maxRiskScore > 100) {
    return "Max risk score must be between 0 and 100.";
  }
  if (input.minHealthFactor <= 0 || input.minHealthFactor > 100) {
    return "Minimum health factor must be greater than 0.";
  }
  if (input.maxProtocolConcentration < 0 || input.maxProtocolConcentration > 100) {
    return "Max protocol concentration must be between 0 and 100%.";
  }
  if (input.minLiquidityScore < 0 || input.minLiquidityScore > 100) {
    return "Minimum liquidity score must be between 0 and 100%.";
  }
  return null;
}

/**
 * Opens the wallet to write the caller's thresholds into risk-policy.clar.
 * The contract keys on `tx-sender`, so the policy belongs to the signing wallet
 * rather than to RiskRail.
 */
export async function writeRiskPolicy(input: PolicyInput): Promise<string> {
  const contract = process.env.NEXT_PUBLIC_RISK_POLICY_CONTRACT;
  if (!contract) {
    throw new Error(
      "No policy contract is configured for this deployment yet.",
    );
  }

  const problem = validate(input);
  if (problem) throw new Error(problem);

  const result = await request("stx_callContract", {
    contract: contract as `${string}.${string}`,
    functionName: "set-risk-policy",
    functionArgs: toContractArgs(input),
    network:
      process.env.NEXT_PUBLIC_STACKS_NETWORK === "mainnet" ? "mainnet" : "testnet",
  });

  if (!result?.txid) throw new Error("The wallet did not return a transaction id.");
  return result.txid;
}

export function explorerTxUrl(txid: string): string {
  const chain =
    process.env.NEXT_PUBLIC_STACKS_NETWORK === "mainnet" ? "mainnet" : "testnet";
  return `https://explorer.hiro.so/txid/${txid}?chain=${chain}`;
}
