import { CliContext } from "@/index";
import { singleTransfer } from "../../utils/transferUtils";
import { getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as utils from "../../utils/utils"
import { PublicKey } from "@metaplex-foundation/js"
import consola from "consola";
import { transferCallbackMessage, transferProcessingMessage } from "../../utils/messageUtils";
import fs from "fs"
import { Keypair, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { Result, Ok, Err } from "../../types/share";
import { dataFormatForBatchTransferByLineCheck } from "../../hooks/beforeOperationHook";

export const transferToken = async(cctx: CliContext, fromKp: Keypair, to: string, amount: number): Promise<Result<string>> => {
    if (!cctx.configs.admin_wallet_keypair) {
        return Err("Admin wallet keypair is not configured in CLI context")
    }
    try {
        const tokenDecimalNumber = await utils.getNumberOfDecimals(cctx.connection, cctx.itaTokenMintPDA)
        const amountToTransfer = amount * Math.pow(10, tokenDecimalNumber)
        const senderAddress = fromKp.publicKey
        const senderTokenAccount = getAssociatedTokenAddressSync(
            cctx.itaTokenMintPDA,
            senderAddress,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        )
        const destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
            cctx.connection,
            fromKp,
            new PublicKey(cctx.itaTokenMintPDA),
            new PublicKey(to)
        )

        const sig = await singleTransfer(
            cctx,
            fromKp,
            senderTokenAccount,
            destinationTokenAccount.address,
            senderAddress,
            amountToTransfer
        )
        return Ok(sig)
    } catch (err) {
        return Err(err instanceof Error ? err.message : "an unexpected error occurred")
    }
}

export const transferTokenHandler = async(cctx: CliContext, options: any) => {
    const fromKeypair = options.fromKeypair == "admin" ? cctx.configs.admin_wallet_keypair : utils.loadKeypair(options.fromKeypair)
    transferProcessingMessage(fromKeypair!.publicKey.toBase58(), options.to, options.amounts)
    const result = await transferToken(cctx, fromKeypair!, options.to, options.amount)
    !result.ok ? transferCallbackMessage(true) : transferCallbackMessage(false, result.value)
}



// NOTE : batch transfer is only allowed for the scenario that admin is the sender
export const batchTransfer = async(cctx: CliContext, filePath: string): Promise<Result<string>> => {
    if (!filePath) {
        return Err("Option --file is mandatory for batch transfer");
    }
    if (!fs.existsSync(filePath)) {
        return Err("declared file does not exist");
    }

    if (!cctx.configs.admin_wallet_keypair) return Err("Admin wallet keypair is not configured in CLI context")
    const adminAddress = cctx.configs.admin_wallet_keypair.publicKey

    const content = (await utils.readFromFileLineByLine(filePath)).filter(line => line.trim().length > 0)
    for (const [idx, c] of content) {
        if (!dataFormatForBatchTransferByLineCheck(c)) {
            return Err(`data is not in right format in line ${idx}`)
        }
        if (c.split(";")[0] == adminAddress.toString()) {
            return Err(`admin wallet as destination is not allowed`)
        }
    }    
    const tokenDecimalNumber = await utils.getNumberOfDecimals(cctx.connection, cctx.itaTokenMintPDA)
    content.forEach(async(c) => {
        const destinationAddress = c.split(";")[0]
        const amount = c.split(";")[1]
        const amountToTransfer = Number(amount) * Math.pow(10, tokenDecimalNumber)

        const adminTokenAccount = getAssociatedTokenAddressSync(
            cctx.itaTokenMintPDA,
            adminAddress,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        )

        const destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
            cctx.connection,
            cctx.configs.admin_wallet_keypair!,
            new PublicKey(cctx.itaTokenMintPDA),
            new PublicKey(destinationAddress)
        )
        
        consola.start(`Transfering ${amountToTransfer/1e9} amount of token from ${adminAddress.toString().slice(0, 4)}...${adminAddress.toString().slice(-4, adminAddress.toString().length)} to ${destinationAddress.slice(0, 4)}...${destinationAddress.slice(-4, destinationAddress.length)}`)
        const sig = await singleTransfer(
            cctx,
            cctx.configs.admin_wallet_keypair!,
            adminTokenAccount,
            destinationTokenAccount.address,
            adminAddress,
            amountToTransfer
        )
        consola.success(`Transfer Transaction Success! 🎉 Tx: ${sig}`);
    })
    return Ok()
}

export const batchTransferHandler = async(cctx: CliContext, options: any) => {
    const result = await batchTransfer(cctx, options.file)
    !result.ok ? transferCallbackMessage(true) : transferCallbackMessage(false);
}


export const nativeTransfer = async(cctx: CliContext, fromKp: Keypair, toPk: PublicKey, lamports: number): Promise<Result<string>> => {
    try {
        const transferTx = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: fromKp.publicKey,
                toPubkey: toPk,
                lamports: lamports
            })
        )
        const signature = await sendAndConfirmTransaction(
            cctx.connection,
            transferTx,
            [fromKp]
        )
        return Ok(signature)
    } catch (err) {
        return Err(err instanceof Error ? err.message : "an unexpected error occurred")
    }
}

export const nativeTransferHandler = async(cctx: CliContext, options: any) => {
    const fromKeypair = options.fromKeypair && options.fromKeypair != "admin" ? utils.loadKeypair(options.fromKeypair) : cctx.configs.admin_wallet_keypair!
    transferProcessingMessage(fromKeypair.publicKey.toBase58(), options.to, options.amount)
    const result = await nativeTransfer(cctx, fromKeypair, options.to, options.amount)
    !result.ok ? transferCallbackMessage(true) : transferCallbackMessage(false, result.value)
}