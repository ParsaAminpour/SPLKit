import { web3 } from "@coral-xyz/anchor";
import { HeliusClient } from "helius-sdk";
import { Result, Ok, Err } from "../types/share";

// Set reasonable bounds
const MIN_UNITS = 10000;
const MAX_UNITS = 1400000; // Solana's max per transaction

export const confirmTransaction = async (
    connection: web3.Connection,
    signature: web3.TransactionSignature,
    desiredConfirmationStatus: web3.TransactionConfirmationStatus = 'confirmed',
    timeout: number = 30000,
    pollInterval: number = 1000,
    searchTransactionHistory: boolean = false
  ): Promise<web3.SignatureStatus> => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const { value: statuses } = await connection.getSignatureStatuses([signature], { searchTransactionHistory });
        if (!statuses || statuses.length === 0) {
            throw new Error('Failed to get signature status');
        }
        const status = statuses[0];
        if (status === null) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
        }
        if (status.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
  
        if (status.confirmationStatus && status.confirmationStatus === desiredConfirmationStatus) return status;
  
        if (status.confirmationStatus === 'finalized') return status;
  
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    throw new Error(`Transaction confirmation timeout after ${timeout}ms`);
}

export enum PriorityLevel { LOW, MEDIUM, HIGH, VERY_HIGH, UNSAFE_MAX }

// Formula: Total priority fee = Price per compute unit × Compute units consumed
// Formula: Priority Fee = Compute Unit Limit × Compute Unit Price
// NOTE : We ignoring min level comes from the API response, due to this we increment the priority by one
export const getPriorityFeeInfo = async(helius: HeliusClient, accountKey: string, _priorityLevel: number = PriorityLevel.MEDIUM): Promise<Result<number>> => {
    try {
      const estimate = await helius.getPriorityFeeEstimate({
        // accountKeys: ["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"],
        accountKeys: [accountKey],
        options: { includeAllPriorityFeeLevels: true },
      });

      if (!Object.keys(estimate.priorityFeeLevels).includes("medium")) return Err("failed to get priority fee from helius")
      let res: number = estimate.priorityFeeLevels.medium
      switch (_priorityLevel++) {
        case PriorityLevel.LOW: res = estimate.priorityFeeLevels.low; break
        case PriorityLevel.MEDIUM: res = estimate.priorityFeeLevels.medium; break
        case PriorityLevel.HIGH: res = estimate.priorityFeeLevels.high; break
        case PriorityLevel.VERY_HIGH: res = estimate.priorityFeeLevels.veryHigh; break
        case PriorityLevel.UNSAFE_MAX: res = estimate.priorityFeeLevels.unsafeMax; break
      }
      return Ok(res)
    } catch (error) {
      return Err(`Error with RPC: ${error}`);
    }
}

export const getUnitConsumed = (unitsConsumed: number): number => {
    const bufferMultiplier = 1.25; // 25% buffer
    const optimalUnits = Math.ceil(unitsConsumed * bufferMultiplier);
    return Math.min(Math.max(optimalUnits, MIN_UNITS), MAX_UNITS);   
}