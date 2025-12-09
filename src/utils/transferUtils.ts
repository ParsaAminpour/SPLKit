import { PublicKey } from "@metaplex-foundation/js";
import { Keypair, sendAndConfirmTransaction } from "@solana/web3.js";
import { Transaction } from "@solana/web3.js";
import { createTransferInstruction } from "@solana/spl-token";
import { CliContext } from "..";
// import { confirmTransaction } from "./transaction";

export const singleTransfer = async(cctx: CliContext, fromKeypair: Keypair, fromATA:PublicKey, toATA: PublicKey, ownerPk: PublicKey, amountWithDecimal: number): Promise<string> => {
    const tx = new Transaction()
    tx.add(createTransferInstruction(
        fromATA,
        toATA,
        ownerPk,
        amountWithDecimal
    ))

    const latestBlockHash = await cctx.connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = await latestBlockHash.blockhash;    
    const signature = await sendAndConfirmTransaction(cctx.connection, tx, [fromKeypair]);
    // const sigStatus = await confirmTransaction(cctx.connection, signature)
    // consola.log(`sig status: ${sigStatus.confirmationStatus}\n`)
    return signature
}