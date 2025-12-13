import { web3 } from "@coral-xyz/anchor"
import { PublicKey } from "@metaplex-foundation/js"
import { Keypair, ParsedAccountData } from "@solana/web3.js"
import fs from "fs";

export const getNumberOfDecimals = async(connection: web3.Connection, mintAddress: PublicKey) => {
    const info = await connection.getParsedAccountInfo(mintAddress)
    return (info.value?.data as ParsedAccountData).parsed?.info.decimals
}

export const getAdminKeypair = (): Keypair => {
    if (!fs.existsSync("wallet.json")) throw new Error("file wallet.json doesn't exist")
        const admingPrivateKey = JSON.parse(fs.readFileSync("wallet.json", "utf-8"))
        return Keypair.fromSecretKey(Buffer.from(admingPrivateKey))
}

export const writeToFile = async (filePath: string, content: string[]) => {
    const contentWithNewlines = content.join('\n')
    fs.writeFileSync(filePath, contentWithNewlines)
}

export const readFromFile = async(filePath: string): Promise<string> => {
    const content = fs.readFileSync(filePath, "utf-8")
    return content    
}

export const readFromFileLineByLine = async(filePath: string): Promise<string[]> => {
    const content = await readFromFile(filePath)
    return content.split(/\r?\n/);
}