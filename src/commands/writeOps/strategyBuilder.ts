import { initSdk } from "../../configs/poolConfig";
import { CliContext } from "@/index";
import { bundleCallbackMessage, confirmOrExit, mintCallbackMessage, showFailure, showWarning, strategyCallbackMessage, strategyProcessingMessage, swapCallbackMessage, transferCallbackMessage } from "../../utils/messageUtils";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import fs from "fs"
import { showFailureAndReturn } from "../../utils/messageUtils";
import { beforeStrategyOpsCheck } from "../../hooks/beforeOperationHook"
import { mintToken } from "./mint";
import { getSwapITATokenIx, SwapDirection, swapITAToken } from "./swap";
import { createTransferInstruction, NATIVE_MINT, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { nativeTransfer, transferToken } from "./transfer";
import { loadKeypair } from "../../utils/utils";
import { PublicKey } from "@metaplex-foundation/js";
import { Result, Ok, Err } from "../../types/share";
import { Keypair, SystemProgram, Transaction, TransactionInstruction, TransactionInstructionCtorFields } from "@solana/web3.js";
import { executeTransactions } from "../../utils/transactionUtils";
import { getDepositPoolIx } from "./deposit";

export interface MintToOp {
    id: string,
    operation: "mintTo",
    destinationAccount: string,
    amount: number,
    priorityLevel?: number, // default is 2
    timeToExecute?: number | null
}

export interface TransferOp {
    id: string,
    operation: "transfer",
    assetPDA: string,
    signer?: string, // Optional when inside bundle - bundle provides the keypair
    toPk: string,
    amount: number,
    priorityLevel?: number, // default is 2
    timeToExecute?: number | null
}

export interface SwapOp {
    id: string,
    operation: "swap",
    inputMintPDA: string,
    outputMintPDA: string,
    signer?: string, // Optional when inside bundle - bundle provides the keypair
    amount: number,
    priorityLevel?: number, // default is 2
    timeToExecute?: number | null
}

export interface DepositOP {
    id: string,
    operation: "deposit",
    isBase: boolean, // base refers to SOL
    amount: number,
    // slippage?: number,
    signer?: string, // Optional when inside bundle - bundle provides the keypair
    priorityLevel?: number, // default is 2
    timeToExecute?: number | null
}

type IndividualOperation = MintToOp | TransferOp | SwapOp | DepositOP

export interface BundleOp {
    id: string,
    operation: "bundle",
    operations: IndividualOperation[],
    signer: string,
    priorityLevel?: number, // default is 2, applies to the entire bundle
    timeToExecute?: number | null
}

type StrategyOperation = IndividualOperation | BundleOp

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

type TransactionIx = Transaction | TransactionInstruction | TransactionInstructionCtorFields

// TODO : implement the scheduling feature for this command handler.
export const strategyBuilder = async (
    _cctx: CliContext,
    _strategyFileRoute: string,
    _isScheduled: boolean,
    _withDelay?: number,
    startsWith?: string,
    askBeforeAction: boolean = false
): Promise<Result<Success>> => {
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
            if (!op.operation || !["mintTo", "transfer", "swap", "deposit", "bundle"].includes(op.operation)) {
                showFailureAndReturn(`Invalid operation type: ${op.operation}. Must be one of: mintTo, transfer, swap, deposit, bundle`);
            }
            if (op.operation === "bundle") {
                const bundleOp = op as BundleOp;
                if (!bundleOp.operations || !Array.isArray(bundleOp.operations) || bundleOp.operations.length === 0) {
                    showFailureAndReturn(`Bundle operation ${bundleOp.id} must contain a non-empty array of operations`);
                }
                if (!bundleOp.signer) {
                    showFailureAndReturn(`Bundle operation ${bundleOp.id} must have 'signer' specified at the bundle level`);
                }
                for (const bundledOp of bundleOp.operations) {
                    if (!bundledOp.operation || !["mintTo", "transfer", "swap", "deposit"].includes(bundledOp.operation)) {
                        showFailureAndReturn(`Invalid operation type in bundle ${bundleOp.id}: ${bundledOp.operation}. Must be one of: mintTo, transfer, swap`);
                    }
                }
            }
        }
        operations = parsed;
    } catch (e) {
        return Err("The strategy file is not a valid JSON format or it's empty");
    }
    
    if (startsWith) {
        const startIndex = operations.findIndex(op => op.id === startsWith);
        if (startIndex === -1) {
            return Err(`Could not find operation with id == ${startsWith}`);
        }
        operations = operations.slice(startIndex);
    }

    // TODO : Add check for the add liquidity operation
    const result = beforeStrategyOpsCheck(operations, _isScheduled);
    if (!result.ok) {
        return Err(result.error);
    }

    if (askBeforeAction) {
        const { transferCount, swapCount, mintToCount, bundleCount } = operationCounter(operations);
        console.log(`There are ${transferCount} transfer operations, ${swapCount} swap operations, ${mintToCount} mintTo operations, and ${bundleCount} bundle operations in the strategy file.`);
        await confirmOrExit(
            `Do you want to proceed with the strategy using the following data?
            ${transferCount} transfer operations, ${swapCount} swap operations, ${mintToCount} mintTo operations, and ${bundleCount} bundle operations`,
            "Strategy execution has been terminated by the user."
        )
    }

    for (const op of operations) {
        let callerKp: Keypair
        if (op.operation === "bundle") {
            callerKp = op.signer == "admin" ? _cctx.configs.admin_wallet_keypair! : loadKeypair(op.signer)
        } else {
            if (op.operation === "swap") {
                callerKp = op.signer == "admin" ? _cctx.configs.admin_wallet_keypair! : loadKeypair(op.signer!)
            } else if (op.operation === "transfer") {
                callerKp = op.signer == "admin" ? _cctx.configs.admin_wallet_keypair! : loadKeypair(op.signer!)
            } else {
                callerKp = _cctx.configs.admin_wallet_keypair!
            }
        }
        const opRes = await operationMapper(_cctx, op, callerKp)
        if (!opRes.ok) failureCount.push({ id: op.id, operation: op.operation, reason: opRes.error })
        if (_withDelay) await new Promise(r => setTimeout(r, _withDelay));
    }
    return Ok({ 
        operationSucceedCount: operations.length - failureCount.length,
        operationFailedCount: failureCount.length,
    })
}

const operationMapper = async(cctx: CliContext, op: StrategyOperation, callerKp: Keypair): Promise<Result<string>> => {
    const raydium = await initSdk(cctx, undefined, callerKp)
    switch(op.operation) {
        case "mintTo":
            const normalAmount = op.amount / 1e9
            const mintRes = await mintToken(cctx, op.destinationAccount, normalAmount);
            if (!mintRes.ok) {
                mintCallbackMessage(true, undefined, `Operation ID: ${op.id} | ${mintRes.error}`)
                return Err(mintRes.error)
            }
            mintCallbackMessage(false, mintRes.value.split(",")[0])
            return Ok(mintRes.value.split(",")[0])

        case "swap":
            if (!op.signer) {
                return Err(`Operation ID: ${op.id} | Standalone swap operation must have 'signer' specified`)
            }
            const swapRes = await swapITAToken(
                cctx,
                raydium, 
                cctx.configs.raydium_pool_id, 
                op.signer, 
                op.amount, 
                op.inputMintPDA == NATIVE_MINT.toBase58() ? SwapDirection.BUY : SwapDirection.SELL,
                false
            );
            if(!swapRes.ok) { 
                swapCallbackMessage(true, undefined, `Operation ID: ${op.id} | ${swapRes.error}`)
                return Err(swapRes.error)
            }
            swapCallbackMessage(false, swapRes.value)
            return Ok(swapRes.value)

        case "transfer":
            if (!op.signer) {
                return Err(`Operation ID: ${op.id} | Standalone transfer operation must have 'signer' specified`)
            }
            const fromKp = op.signer == "admin" ? cctx.configs.admin_wallet_keypair : loadKeypair(op.signer)
            if (op.assetPDA == cctx.configs.ita_token_mint_pda) {
                const normalAmount = op.amount / 1e9
                const transferRes = await transferToken(cctx, fromKp!, op.toPk, normalAmount, false)
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
            break;

        case "bundle":
            const bundleRes = await bundleOperations(cctx, raydium, op)
            if (!bundleRes.ok) {
                bundleCallbackMessage(true, undefined, `Operation ID: ${op.id} | ${bundleRes.error}`)
                return Err(bundleRes.error)
            }
            bundleCallbackMessage(false, bundleRes.value)
            return Ok(bundleRes.value)
    }
    return Ok()
}

export const bundleOperations = async(cctx: CliContext, raydium: Raydium, op: BundleOp): Promise<Result<string>> => {
    const tx = new Transaction()
    const bundleKeypairPath = op.signer
    if (!bundleKeypairPath) {
        return Err(`Bundle operation ${op.id} must have 'signer' specified at the bundle level`)
    }
    const bundleKeypair = bundleKeypairPath == "admin" ? cctx.configs.admin_wallet_keypair! : loadKeypair(bundleKeypairPath)

    for (const bundledOp of op.operations) {
        switch(bundledOp.operation) {
            case "swap":
                const swapIxRes = await getSwapITATokenIx(
                    cctx,
                    raydium,
                    cctx.configs.raydium_pool_id,
                    bundleKeypairPath, // Use bundle-level callerKp
                    bundledOp.amount,
                    bundledOp.inputMintPDA == NATIVE_MINT.toBase58() ? SwapDirection.BUY : SwapDirection.SELL,
                    bundledOp.priorityLevel
                )
                if(!swapIxRes.ok) return Err(swapIxRes.error)
                tx.add(swapIxRes.value)
                break;

            case "transfer":
                const senderTokenAccount = getAssociatedTokenAddressSync(
                    cctx.itaTokenMintPDA,
                    bundleKeypair.publicKey,
                    false,
                    TOKEN_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID
                )
                const destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
                    cctx.connection,
                    bundleKeypair,
                    new PublicKey(cctx.itaTokenMintPDA),
                    new PublicKey(bundledOp.toPk)
                )
                let transferIx: TransactionIx
                if (bundledOp.assetPDA == cctx.configs.ita_token_mint_pda) {
                    const normalAmount = bundledOp.amount / 1e9
                    transferIx = createTransferInstruction(senderTokenAccount, destinationTokenAccount.address, bundleKeypair.publicKey, normalAmount)
                } else if (bundledOp.assetPDA == NATIVE_MINT.toBase58()) {
                    transferIx = SystemProgram.transfer({
                        fromPubkey: bundleKeypair.publicKey,
                        toPubkey: new PublicKey(bundledOp.toPk),
                        lamports: bundledOp.amount,
                    })
                } else {
                    showWarning("Attention: You are transfering with unknown token PDA!")
                    transferIx = createTransferInstruction(senderTokenAccount, destinationTokenAccount.address, bundleKeypair.publicKey, bundledOp.amount)
                }
                tx.add(transferIx)
                break
            
            case "deposit":
                const uiAmount = bundledOp.amount / 1e9
                const depositIx = await getDepositPoolIx(
                    cctx, 
                    bundleKeypair, 
                    uiAmount, 
                    bundledOp.isBase, 
                    undefined, 
                    bundledOp.priorityLevel
                )
                if (!depositIx.ok) return Err(depositIx.error)
                tx.add(depositIx.value)
                break

            case "mintTo":
                // mintTo operation requires one mint and one transfer after that
                // However, in traditional bundling, it's not guaranteed that the mint instruction will go before the transfer
        }
    }

    try {
        const settledResults = await executeTransactions(cctx.connection, [tx], bundleKeypair)
        return Ok(settledResults.map(result => result.status === "fulfilled" ? result.value : result.reason).join(", "))
    } catch (error) {
        console.log(`error sending and confirming transaction: ${error}`)
        return Err(error as string)
    }
}

const operationCounter = (ops: StrategyOperation[]): { transferCount: number, swapCount: number, mintToCount: number, bundleCount: number } => {
    let transferCount = 0;
    let swapCount = 0;
    let mintToCount = 0;
    let bundleCount = 0;
    for (const op of ops) {
        if (op.operation === "transfer") transferCount++;
        if (op.operation === "swap") swapCount++;
        if (op.operation === "mintTo") mintToCount++;
        if (op.operation === "bundle") {
            bundleCount++;
            const bundleOp = op as BundleOp;
            for (const bundledOp of bundleOp.operations) {
                if (bundledOp.operation === "transfer") transferCount++;
                if (bundledOp.operation === "swap") swapCount++;
                if (bundledOp.operation === "mintTo") mintToCount++;
            }
        }
    }
    return { transferCount, swapCount, mintToCount, bundleCount };
}


export const strategyBuilderHandler = async(cctx: CliContext, options: any) => {
    try {
        strategyProcessingMessage()
        const result = await strategyBuilder(cctx,options.file, options.schedule, options.delay, options.startsWith, true)
        !result.ok 
            ? strategyCallbackMessage(true, undefined, undefined, result.error) 
            : strategyCallbackMessage(false, result.value.operationSucceedCount, result.value.operationFailedCount, undefined); 
    } catch(error) {
        showFailure(`something bad happened with this error:\n${error}`)
    }
}