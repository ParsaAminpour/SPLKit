import { PublicKey } from "@metaplex-foundation/js";
import { Keypair, sendAndConfirmTransaction } from "@solana/web3.js";
import { Transaction } from "@solana/web3.js";
import { createTransferInstruction } from "@solana/spl-token";
import { CliContext } from "..";
import { PriorityLevel } from "./transactionUtils";
import { ComputeBudgetProgram } from "@solana/web3.js";
import { Result, Err, Ok } from "../types/share";
import { getPriorityFeeInfo } from "./transactionUtils";
// import { confirmTransaction } from "./transaction";

export const singleTransfer = async (
    cctx: CliContext,
    fromKeypair: Keypair,
    fromATA: PublicKey,
    toATA: PublicKey,
    ownerPk: PublicKey,
    amountWithDecimal: number,
    priorityLevel: number = PriorityLevel.MEDIUM
): Promise<Result<string>> => {
    const tx = new Transaction()
    const estimate = await getPriorityFeeInfo(cctx.heliusSDK, cctx.configs.ita_token_mint_pda, priorityLevel)
    if (!estimate.ok) return Err(`There is an error in fetching priority estimation fee\n${estimate.error}`)
    
    const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: estimate.value
    })
    const computeLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 200_000,
    });
    const transferIx = createTransferInstruction(fromATA, toATA, ownerPk, amountWithDecimal)
    tx.add(
        computePriceIx, 
        computeLimitIx,
        transferIx
    )

    const latestBlockHash = await cctx.connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = await latestBlockHash.blockhash;    
    const signature = await sendAndConfirmTransaction(cctx.connection, tx, [fromKeypair]);
    // const sigStatus = await confirmTransaction(cctx.connection, signature)
    // consola.log(`sig status: ${sigStatus.confirmationStatus}\n`)
    return Ok(signature)
}