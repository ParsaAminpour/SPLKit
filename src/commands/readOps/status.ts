// import { ITAConfiguration } from "@/configs/configs"
import { CliContext } from "@/index";
import { PublicKey } from "@solana/web3.js";
import * as constant from "../constants"
import { getAssociatedTokenAddressSync, getMint } from "@solana/spl-token"
import Table from 'cli-table3';
import { consola } from "consola";
import { getAssociatedTokenAddress} from "@solana/spl-token"
import { writeToFile } from "../../utils/utils";
import { showFailure, showFailureAndReturn, showSuccess } from "../../utils/messageUtils";
import { Result, Ok, Err } from "../../types/share";
// import { Program, Wallet, web3 } from "@coral-xyz/anchor";
// import { Keypair, PublicKey } from "@solana/web3.js";

export const tokenInfo = async(cctx: CliContext) => {
    consola.start("getting information about token...")
    const [itaTokenMintPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from(constant.ITA_TOKEN_SEED)],
        cctx.program.programId
    )
    const [metadataAccountPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          constant.TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          itaTokenMintPDA.toBuffer(),
        ],
        constant.TOKEN_METADATA_PROGRAM_ID
    );
    
    const reqBody = {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: '{"jsonrpc":"2.0","id":"1","method":"getTokenAccounts","params":{"mint":"3Has4Q1yxdhQgAbByNLpP4EcWDn1nJUpqfSQg3d2W1Am"}}'
    };
    let tokenOwnersData: Array<any>;
    try {
        const response = await fetch(cctx.configs.cluster_url, reqBody);
        const fetchedData = await response.json() as any;
        tokenOwnersData = fetchedData["result"]["token_accounts"];
    } catch (error: any) {
        showFailure(error.message)
        return
    }

    const mintAccount = await getMint(cctx.connection, itaTokenMintPDA)
    const table = new Table()
    table.push(["mintAddress", mintAccount.address.toString()])
    table.push(["tokenSupply", `${mintAccount.supply.toString()} ~ ${mintAccount.supply / BigInt(1e9)}`])
    table.push(["holdersCount", tokenOwnersData.length])
    table.push(["mintAuthority", mintAccount.mintAuthority?.toString()])
    table.push(["freezeAuthority", mintAccount.freezeAuthority?.toString()])
    table.push(["metadataAccountPDA", metadataAccountPDA.toString()])
    console.log(table.toString())
}

// NOTE : userWalletAccount is the user wallet account address, not his associated token address
export const getUserTokenBalance = async(cctx: CliContext, userWalletAccount: PublicKey): Promise<number> => {
      const userATA = await getAssociatedTokenAddress(
          cctx.itaTokenMintPDA, 
          new PublicKey(userWalletAccount), 
      )
      let balance = 0
      try {
          balance = Number((await cctx.connection.getTokenAccountBalance(userATA)).value.amount)
      } catch (error) {
          consola.warn(`User ATA not found, you need to create it first`)
      }
      return balance
}

export const getATABalanceHandler= async(cctx: CliContext, options: any): Promise<number> => {
    const balance = await getUserTokenBalance(cctx, options.address)
    consola.success(`Balance of ${options.address}: ${(balance/1e9).toString()}`)
    // return Number(balance.value.amount.toString())
    return 0
}

export const tokenAccountInfo = async(cctx: CliContext, options: any) => {
    const userATA = await getAssociatedTokenAddressSync(
        cctx.itaTokenMintPDA,
        new PublicKey(options.address)
    )
    consola.success(`Your Associated Token Address is: ${userATA}`)
}

export const getTokenHolders = async(cctx: CliContext, count: number): Promise<Result<Array<any>>> => {
    const reqBody = {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: '{"jsonrpc":"2.0","id":"1","method":"getTokenAccounts","params":{"mint":"3Has4Q1yxdhQgAbByNLpP4EcWDn1nJUpqfSQg3d2W1Am"}}'
    };

    try {
        const response = await fetch(cctx.configs.cluster_url, reqBody);
        const fetchedData = await response.json() as any;
        const tokenOwnersData: Array<any> = fetchedData["result"]["token_accounts"];
        let data = []
        if (count > tokenOwnersData.length || count == 0) count = tokenOwnersData.length 
        for(const owner of tokenOwnersData.slice(0, count)) {
            data.push({owner: owner.owner, balance: `${Number(owner.amount) / 1e9}`})
        }
        data.sort((b1, b2) => Number(b2.balance) - Number(b1.balance))
        return Ok(data)

    } catch (error: any) {
        return Err(error.message)
    }
}
export const getTokeHoldersHandler = async(cctx: CliContext, options: any) => {
    const res = await getTokenHolders(cctx, options.number)
    if(!res.ok) showFailureAndReturn("error in getting token holders", res.error)
    if (res.ok) {
        if (options.output) {
            const content: string[] = res.value.map(line => `owner: ${line.owner} | balance: ${line.balance}\n`)
            await writeToFile(options.output, content);
        } else {
            console.table(res.value.flat())
        }
    }
}

export const getHolderSnapshot = async(cctx: CliContext, options: any) => {
    const res = await getTokenHolders(cctx, 0)
    if(!res.ok) showFailureAndReturn("error in getting token holders", res.error)
    if (res.ok) {
        const content: string[] = res.value.map(line => `owner: ${line.owner} | balance: ${line.balance}\n`)
        writeToFile(options.output, content);
    }
    showSuccess("Holder snapshot has been successfully saved.");
}

export const getTransactionSnapshotHandler = async(cctx: CliContext, options: any) => {
    const limitNumber = options.number == 0 ? 1_000 : Number(options.number) // 1000 is max trxs we can fetch
    const trxList = await cctx.connection.getSignaturesForAddress(new PublicKey(cctx.configs.ita_token_mint_pda), {limit: limitNumber})
    let content: string[] = []
    trxList.forEach((transaction, i) => {
        const date = new Date(transaction.blockTime!*1000);
        content.push(`Transaction No: ${i+1}\n Signature: ${transaction.signature}\n Time: ${date}\n Status: ${transaction.confirmationStatus}\n`)
        if (i != trxList.length-1) content.push(("-").repeat(20) + "\n")
    })
    await writeToFile(options.output, content)
    showSuccess("Transaction snapshot has been successfully saved.");
}