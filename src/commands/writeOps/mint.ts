import { CliContext } from "@/index"
import { PublicKey } from "@metaplex-foundation/js"
import { ASSOCIATED_TOKEN_PROGRAM_ID , getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { singleTransfer } from "../../utils/transferUtils"
import * as utils from "../../utils/utils"
import * as anchor from "@coral-xyz/anchor"
import { Result, Ok, Err } from "../../types/share";
import { mintCallbackMessage, transferCallbackMessage } from "../../utils/messageUtils"


// NOTE : to is the destination wallet address, not Associated Token Account
export const mintToken = async(cctx: CliContext, to: string, amount: number): Promise<Result<string>> => {
    if (!cctx.configs.admin_wallet_keypair) {
        return Err("Admin wallet keypair is not configured in CLI context")
    }
    const adminAddress = cctx.configs.admin_wallet_keypair.publicKey

    let mintTx; 
    let transferTx;
    try {
        const adminTokenAccount = getAssociatedTokenAddressSync(
            cctx.itaTokenMintPDA,
            adminAddress,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        )

        mintTx = await cctx.program.methods.mintToken(
            new anchor.BN(amount)
        ).rpc()
        
        if (to != adminAddress.toString() && amount) {
            const tokenDecimalNumber = await utils.getNumberOfDecimals(cctx.connection, cctx.itaTokenMintPDA)
            const amountToTransfer = amount * Math.pow(10, tokenDecimalNumber)

            const destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
                cctx.connection,
                cctx.configs.admin_wallet_keypair,
                new PublicKey(cctx.itaTokenMintPDA),
                new PublicKey(to)
            )

            transferTx = await singleTransfer(
                cctx,
                cctx.configs.admin_wallet_keypair,
                adminTokenAccount,
                destinationTokenAccount.address,
                cctx.configs.admin_wallet_keypair.publicKey,
                amountToTransfer
            )
        }
    } catch (error) {
        return Err(error as string)
    }
    return Ok(`${mintTx},${transferTx}`)
}

export const mintTokenHandler = async(cctx: CliContext, options: any) => {
    const result = await mintToken(cctx, options.to, options.amount)
    if (result.ok) {
        const [mintTx, transferTx] = (result.value.split(",")[0], result.value.split(",")[1])
        mintCallbackMessage(false, mintTx)
        transferCallbackMessage(false, transferTx)
    } else {
        mintCallbackMessage(true)
    }
}