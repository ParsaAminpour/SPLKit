import { CliContext } from "@/index";
import { singleTransfer } from "../../utils/transferUtils";
import { getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as utils from "../../utils/utils"
import {  PublicKey } from "@metaplex-foundation/js"
import consola from "consola";

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
        
        consola.start(`Transfering ${amountToTransfer/1e9} from ${adminAddress.toString().slice(0, 4)}...${adminAddress.toString().slice(-4, adminAddress.toString().length)} to ${options.to.slice(0, 4)}...${options.to.slice(-4, options.to.length)}`)
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
            `   Transfer Transaction Success!🎉`,
            `\n    https://explorer.solana.com/tx/${sig}?cluster=devnet\n`
        )
    }
}