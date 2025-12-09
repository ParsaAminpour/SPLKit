import { CliContext } from "@/index"
import { PublicKey } from "@metaplex-foundation/js"
import { ASSOCIATED_TOKEN_PROGRAM_ID , getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { consola } from "consola"
import { singleTransfer } from "../../utils/transferUtils"
import * as utils from "../../utils/utils"
import * as anchor from "@coral-xyz/anchor"

export const mintToken = async(cctx: CliContext, options: any) => {
    if (!cctx.configs.admin_wallet_keypair) {
        throw new Error("Admin wallet keypair is not configured in CLI context")
    }
    const adminAddress = cctx.configs.admin_wallet_keypair.publicKey

    const adminTokenAccount = getAssociatedTokenAddressSync(
        cctx.itaTokenMintPDA,
        adminAddress,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    )

    consola.start(`Minting ${options.amount} tokens to ${options.to}`)
    const tx = await cctx.program.methods.mintToken(
        new anchor.BN(options.amount)
    ).rpc()
    consola.success(
        '\x1b[32m', 
        `   Mint Transaction Success!🎉`,
        `\n https://explorer.solana.com/tx/${tx}?cluster=devnet\n`
    )

    if (options.to != adminAddress.toString() && options.amount) {
        const tokenDecimalNumber = await utils.getNumberOfDecimals(cctx.connection, cctx.itaTokenMintPDA)
        const amountToTransfer = options.amount * Math.pow(10, tokenDecimalNumber)

        const destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
            cctx.connection,
            cctx.configs.admin_wallet_keypair,
            new PublicKey(cctx.itaTokenMintPDA),
            new PublicKey(options.to)
        )
        
        consola.start(`Transfering ${amountToTransfer} from ${adminAddress.toString().slice(0, 4)}...${adminAddress.toString().slice(-4, adminAddress.toString().length)} to ${options.to.slice(0, 4)}...${options.to.slice(-4, options.to.length)}`)
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