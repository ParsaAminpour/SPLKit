import { PublicKey } from "@metaplex-foundation/js";
import { Keypair, sendAndConfirmTransaction } from "@solana/web3.js";
import { Transaction } from "@solana/web3.js";
import { createTransferInstruction } from "@solana/spl-token";
import { CliContext } from "..";

export const singleTransfer = async(cctx: CliContext, fromKeypair: Keypair, fromPk:PublicKey, toPk: PublicKey, ownerPk: PublicKey, amountWithDecimal: number): Promise<string> => {
    const tx = new Transaction()
    tx.add(createTransferInstruction(
        fromPk,
        toPk,
        ownerPk,
        amountWithDecimal
    ))

    const latestBlockHash = await cctx.connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = await latestBlockHash.blockhash;    
    const signature = await sendAndConfirmTransaction(cctx.connection, tx, [fromKeypair]);
    return signature
}