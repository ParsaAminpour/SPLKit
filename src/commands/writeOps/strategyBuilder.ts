import { initSdk } from "../../configs/poolConfig";
import { CliContext } from "@/index";
import { mintCallbackMessage, showFailure, strategyCallbackMessage, strategyProcessingMessage, swapCallbackMessage, transferCallbackMessage } from "../../utils/messageUtils";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import fs from "fs"
import { showFailureAndReturn } from "../../utils/messageUtils";
import { beforeStrategyOpsCheck } from "../../hooks/beforeOperationHook"
import { mintToken } from "./mint";
import { SwapDirection, swapITAToken } from "./swap";
import { NATIVE_MINT } from "@solana/spl-token";
import { nativeTransfer, transferToken } from "./transfer";
import { loadKeypair } from "../../utils/utils";
import { PublicKey } from "@metaplex-foundation/js";
import { Result, Ok, Err } from "../../types/share";

export interface MintToOp {
    id: string,
    operation: "mintTo",
    destinationAccount: string,
    amount: number,
    timeToExecute?: number | null
}

export interface TransferOp {
    id: string,
    operation: "transfer",
    assetPDA: string,
    fromKp: string,
    toPk: string,
    amount: number,
    timeToExecute?: number | null
}

export interface SwapOp {
    id: string,
    operation: "swap",
    inputMintPDA: string,
    outputMintPDA: string,
    callerKp: string,
    amount: number,
    timeToExecute?: number | null
}

type StrategyOperation = MintToOp | TransferOp | SwapOp

type StrategyFileContent = StrategyOperation[]

type Failure = {
    id: string;
    operation: string;
    reason: string;
};
type Success = {
    operationSucceedCount: number,
    operationFailedCount: number,
}

// TODO : implement the scheduling feature for this command handler.
export const strategyBuilder = async(_cctx: CliContext, _raydium: Raydium, _strategyFileRoute: string, _isScheduled: boolean, _withDelay?: number): Promise<Result<Success>> => {
    if (!fs.existsSync(_strategyFileRoute)) showFailureAndReturn("The target file doesn't exist")
    if (!_strategyFileRoute.endsWith(".json")) {
        return Err("The strategy file must be a .json file.");
    }
    let operations: StrategyFileContent;
    let failureCount: Failure[] = [];
    try {
        const rawContent = fs.readFileSync(_strategyFileRoute, "utf-8");
        const parsed = JSON.parse(rawContent) as StrategyFileContent;        
        if (!Array.isArray(parsed)) showFailureAndReturn("Strategy file must contain an array of operations");
        
        for (const op of parsed) {
            if (!op.operation || !["mintTo", "transfer", "swap"].includes(op.operation)) {
                showFailureAndReturn(`Invalid operation type: ${op.operation}. Must be one of: mintTo, transfer, swap`);
            }
        }
        operations = parsed;
    } catch (e) {
        return Err("The strategy file is not a valid JSON format or it's empty");
    }
    
    const result = beforeStrategyOpsCheck(operations, _isScheduled);
    if (!result.ok) {
        return Err(result.error);
    }

    for (const op of operations) {
        const opRes = await operationMapper(_cctx, op)
        if (!opRes.ok) failureCount.push({ id: op.id, operation: op.operation, reason: opRes.error })
        if (_withDelay) await new Promise(r => setTimeout(r, 10));
    }
    return Ok({ 
        operationSucceedCount: operations.length - failureCount.length,
        operationFailedCount: failureCount.length,
    })
}

const operationMapper = async(cctx: CliContext, op: StrategyOperation): Promise<Result<string>> => {
    const raydium = await initSdk(cctx)
    switch(op.operation) {
        case "mintTo": 
            const mintRes = await mintToken(cctx, op.destinationAccount, op.amount);
            if (!mintRes.ok) {
                mintCallbackMessage(true, undefined, `Operation ID: ${op.id} | ${mintRes.error}`)
                return Err(mintRes.error)
            }
            mintCallbackMessage(false, mintRes.value.split(",")[0])
            return Ok(mintRes.value.split(",")[0])

        case "swap":
            const swapRes = await swapITAToken(cctx, raydium, cctx.configs.raydium_pool_id, op.callerKp, op.amount, op.inputMintPDA == NATIVE_MINT.toBase58() ? SwapDirection.BUY : SwapDirection.SELL, false);
            if(!swapRes.ok) { 
                swapCallbackMessage(true, undefined, `Operation ID: ${op.id} | ${swapRes.error}`) 
                return Err(swapRes.error)
            }
            swapCallbackMessage(false, swapRes.value)
            return Ok(swapRes.value)

        case "transfer":
            const fromKp = op.fromKp == "admin" ? cctx.configs.admin_wallet_keypair : loadKeypair(op.fromKp)
            if (op.assetPDA == cctx.configs.ita_token_mint_pda) {
                const transferRes = await transferToken(cctx, fromKp!, op.toPk, op.amount, false)
                if (!transferRes.ok) { 
                    transferCallbackMessage(true, undefined, `Operation ID: ${op.id} | ${transferRes.error}`) 
                    return Err(transferRes.error)
                }
                transferCallbackMessage(false, transferRes.value)
                return Ok(transferRes.value)
            }
            else if (op.assetPDA == NATIVE_MINT.toBase58()) {
                const transferRes = await nativeTransfer(cctx, fromKp!, new PublicKey(op.toPk), op.amount, false) // in lamports
                if (!transferRes.ok) {
                    transferCallbackMessage(true, undefined, `Operation ID: ${op.id} | ${transferRes.error}`)
                    return Err(transferRes.error)
                }
                transferCallbackMessage(false, transferRes.value)
                return Ok(transferRes.value)
            }
    }
    return Ok()
}

export const strategyBuilderHandler = async(cctx: CliContext, options: any) => {
    const raydium = await initSdk(cctx)
    try {
        strategyProcessingMessage()
        const result = await strategyBuilder(cctx, raydium, options.file, options.schedule, options.delay)
        !result.ok 
            ? strategyCallbackMessage(true, undefined, undefined, result.error) 
            : strategyCallbackMessage(false, result.value.operationSucceedCount, result.value.operationFailedCount, undefined); 
    } catch(error) {
        showFailure(`something bad happened with this error:\n${error}`)
    }
}