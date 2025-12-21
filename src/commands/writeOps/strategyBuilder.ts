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
    operation: "mintTo",
    destinationAccount: string,
    amount: number,
    timeToExecute?: number | null
}

export interface TransferOp {
    operation: "transfer",
    assetPDA: string,
    fromKp: string,
    toPk: string,
    amount: number,
    timeToExecute?: number | null
}

export interface SwapOp {
    operation: "swap",
    inputMintPDA: string,
    outputMintPDA: string,
    callerKp: string,
    amount: number,
    timeToExecute?: number | null
}

type StrategyOperation = MintToOp | TransferOp | SwapOp

type StrategyFileContent = StrategyOperation[]

// TODO : implement the scheduling feature for this command handler.
export const strategyBuilder = async(_cctx: CliContext, _raydium: Raydium, _strategyFileRoute: string, _isScheduled: boolean, _withDelay?: number): Promise<Result<string>> => {
    if (!fs.existsSync(_strategyFileRoute)) showFailureAndReturn("The target file doesn't exist")
    if (!_strategyFileRoute.endsWith(".json")) {
        return Err("The strategy file must be a .json file.");
    }
    let operations: StrategyFileContent;
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
        await operationMapper(_cctx, op)
        if (_withDelay) await new Promise(r => setTimeout(r, 10));
    }
    return Ok(operations.length.toString())
}

const operationMapper = async(cctx: CliContext, op: StrategyOperation) => {
    const raydium = await initSdk(cctx)
    switch(op.operation) {
        case "mintTo": 
            const mintRes = await mintToken(cctx, op.destinationAccount, op.amount);
            !mintRes.ok ? mintCallbackMessage(true, mintRes.error) : mintCallbackMessage(false, mintRes.value.split(",")[0])
            break
        case "swap":
            const swapRes = await swapITAToken(cctx, raydium, cctx.configs.raydium_pool_id, op.amount, op.inputMintPDA == NATIVE_MINT.toBase58() ? SwapDirection.BUY : SwapDirection.SELL, false);
            !swapRes.ok ? swapCallbackMessage(true, swapRes.error) : swapCallbackMessage(false, swapRes.value)
            break
        case "transfer":
            const fromKp = op.fromKp == "admin" ? cctx.configs.admin_wallet_keypair : loadKeypair(op.fromKp)
            if (op.assetPDA == cctx.configs.ita_token_mint_pda) {
                const transferRes = await transferToken(cctx, fromKp!, op.toPk, op.amount)
                !transferRes.ok ? transferCallbackMessage(true, transferRes.error) : transferCallbackMessage(false, transferRes.value)
            }
            else if (op.assetPDA == NATIVE_MINT.toBase58()) {
                const transferRes = await nativeTransfer(cctx, fromKp!, new PublicKey(op.toPk), op.amount) // in lamports
                !transferRes.ok ? transferCallbackMessage(true, transferRes.error) : transferCallbackMessage(false, transferRes.value)
            }
            break
    }
}

export const strategyBuilderHandler = async(cctx: CliContext, options: any) => {
    const raydium = await initSdk(cctx)
    try {
        strategyProcessingMessage()
        const result = await strategyBuilder(cctx, raydium, options.file, options.schedule, options.delay)
        !result.ok ? strategyCallbackMessage(true, result.error) : strategyCallbackMessage(false, result.value); 
    } catch(error) {
        showFailure(`something bad happened with this error:\n${error}`)
    }
}