import { CliContext } from "@/index";
import { singleTransfer } from "../../utils/transferUtils";
import { getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as utils from "../../utils/utils"
import {  PublicKey } from "@metaplex-foundation/js"
import consola from "consola";
import { showFailure } from "../../utils/messageUtils";
import fs from "fs"

export const transferToken = async(cctx: CliContext, options: any) => {
    if (options.to != cctx.configs.admin_wallet_keypair?.publicKey.toString() && options.amount) {
        if (!cctx.configs.admin_wallet_keypair) {
            throw new Error("Admin wallet keypair is not configured in CLI context")
        }
        const tokenDecimalNumber = await utils.getNumberOfDecimals(cctx.connection, cctx.itaTokenMintPDA)
        const amountToTransfer = options.amount * Math.pow(10, tokenDecimalNumber)
        const adminAddress = cctx.configs.admin_wallet_keypair.publicKey

        const adminTokenAccount = getAssociatedTokenAddressSync(
            cctx.itaTokenMintPDA,
            adminAddress,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        )

        const destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
            cctx.connection,
            cctx.configs.admin_wallet_keypair,
            new PublicKey(cctx.itaTokenMintPDA),
            new PublicKey(options.to)
        )
        
        consola.start(`Transfering ${amountToTransfer/1e9} amount of token from ${adminAddress.toString().slice(0, 4)}...${adminAddress.toString().slice(-4, adminAddress.toString().length)} to ${options.to.slice(0, 4)}...${options.to.slice(-4, options.to.length)}`)
        const sig = await singleTransfer(
            cctx,
            cctx.configs.admin_wallet_keypair,
            adminTokenAccount,
            destinationTokenAccount.address,
            cctx.configs.admin_wallet_keypair.publicKey,
            amountToTransfer
        )
        consola.success(
            '\x1b[32m', 
            `Transfer Transaction Success!🎉\n`,
            `  https://explorer.solana.com/tx/${sig}?cluster=devnet\n`
        )
    }
}

export const batchTransfer = async(cctx: CliContext, options: any) => {
    if (!options.file) {
        showFailure("Option --file is mandatory for batch transfer");
        return
    }
    if (!fs.existsSync(options.file)) {
        showFailure("declared file does not exist");
        return
    }

    if (!cctx.configs.admin_wallet_keypair) throw new Error("Admin wallet keypair is not configured in CLI context")
    const adminAddress = cctx.configs.admin_wallet_keypair.publicKey

    const content = (await utils.readFromFileLineByLine(options.file)).filter(line => line.trim().length > 0)
    content
        .forEach((c, idx) => {
            if (!checkDataFormatForBatchTransferByLine(c)) {
                showFailure(`data is not in right format in line ${idx}`)
                return
            }
            if (c.split(";")[0] == adminAddress.toString()) {
                showFailure(`admin wallet as destination is not allowed`)
                return
            }
        })
    
    const tokenDecimalNumber = await utils.getNumberOfDecimals(cctx.connection, cctx.itaTokenMintPDA)
    content.forEach(async(c) => {
        if (!cctx.configs.admin_wallet_keypair) throw new Error("Admin wallet keypair is not configured in CLI context")
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
            cctx.configs.admin_wallet_keypair,
            new PublicKey(cctx.itaTokenMintPDA),
            new PublicKey(destinationAddress)
        )
        
        consola.start(`Transfering ${amountToTransfer/1e9} amount of token from ${adminAddress.toString().slice(0, 4)}...${adminAddress.toString().slice(-4, adminAddress.toString().length)} to ${destinationAddress.slice(0, 4)}...${destinationAddress.slice(-4, destinationAddress.length)}`)
        const sig = await singleTransfer(
            cctx,
            cctx.configs.admin_wallet_keypair,
            adminTokenAccount,
            destinationTokenAccount.address,
            adminAddress,
            amountToTransfer
        )
        consola.success(
            '\x1b[32m', 
            `Transfer Transaction Success!🎉\n`,
            `  https://explorer.solana.com/tx/${sig}?cluster=devnet\n`
        )
    })
}

const checkDataFormatForBatchTransferByLine = (line: string): boolean => {
    const re = /^[1-9A-HJ-NP-Za-km-z]{32,44};\d+$/
    return re.test(line)
}