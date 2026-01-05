#!/usr/bin/env node
import { program } from "commander";
import { ITAConfiguration } from "./configs/configs";
import { AnchorProvider, Program, web3, Wallet } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor"
import { PublicKey } from "@solana/web3.js";
import { ItaToken } from "./types/ita_token";
import fs from "fs"
import { getConfig, setConfig } from "./commands/readOps/configs";
import { configs } from "./commands/readOps/configs";
import * as constant from "./commands/constants"
import { getATABalanceHandler, getHolderSnapshot, getTokeHoldersHandler } from "./commands/readOps/status"
import { tokenInfo, tokenAccountInfo, getTransactionSnapshotHandler } from "./commands/readOps/status"
import { mintTokenHandler } from "./commands/writeOps/mint";
import { transferTokenHandler, nativeTransferHandler, batchTransferHandler } from "./commands/writeOps/transfer";
import * as utils from "./utils/utils"
import { poolInfo, getPoolPrice, getPoolStats } from "./commands/readOps/poolInfo"
import { depositPoolHandler } from "./commands/writeOps/deposit"
import { swapITATokenHandler } from "./commands/writeOps/swap";
import { createPoolHandle } from "./commands/writeOps/createCPMMPool"
import { strategyBuilderHandler } from "./commands/writeOps/strategyBuilder"
import { createCommands } from "./commands/commands"
import { createHelius, HeliusClient } from "helius-sdk";
import { getPricePredictHandler } from "./commands/readOps/swapInfo";

export interface CliContext {
    readonly program: Program<anchor.Idl>,
    readonly connection: web3.Connection,
    readonly provider: AnchorProvider,
    readonly itaTokenMintPDA: PublicKey,
    heliusSDK: HeliusClient,
    configs: ITAConfiguration,
    // getProgramId(): string,
    // getConnectionCluster(): string,
    // getConfigs(): ITAConfiguration
}

const setup = (): CliContext => {
    const conf = configs.load()
    const connection = new anchor.web3.Connection(conf.cluster_url, "confirmed");

    const adminKeypair = utils.getAdminKeypair()
    conf.admin_wallet_keypair = adminKeypair
    const adminWallet = new Wallet(adminKeypair)

    const provider = new anchor.AnchorProvider(connection, adminWallet, {
        commitment: "confirmed",
    });
    anchor.setProvider(provider)

    if (!fs.existsSync("ita_token.json")) throw new Error("file ita_token.json doesn't exist")
    const ITATokenIDL = JSON.parse(fs.readFileSync("ita_token.json", "utf-8")) as ItaToken
    const program = new Program(ITATokenIDL as anchor.Idl)

    const [itaTokenMintPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from(constant.ITA_TOKEN_SEED)],
        program.programId
    );

    const apiKey = conf.helius_api_key
    const helius = createHelius({ apiKey })

    const cctx: CliContext = {
        program: program,
        connection: connection,
        provider: provider,
        itaTokenMintPDA: itaTokenMintPDA,
        configs: conf,
        heliusSDK: helius
    }
    return cctx
}
const cctx = setup()

const main = async() => {
    const commands = createCommands(cctx)
    
    commands.getConfigCommand.action((options) => getConfig(options))
    commands.setConfigCommand.action((options) => setConfig(options))

    commands.balanceCommand.action(async(options) => {await getATABalanceHandler(cctx, options)})
    // token metadata extracted from Metaplex
    commands.tokenInfoCommand.action(() => tokenInfo(cctx))
    commands.tokenAccountInfoCommand.action(async(options) => await tokenAccountInfo(cctx, options))
    commands.topHoldersCommand.action(async(options) => await getTokeHoldersHandler(cctx, options))

    commands.holdersSnapshotCommand.action(async(options) => await getHolderSnapshot(cctx, options))
    commands.transactionsSnapshotCommand.action(async(options) => await getTransactionSnapshotHandler(cctx, options))

    commands.pricePredict.action(async(options) => await getPricePredictHandler(cctx, options))

    commands.mintCommand.action(async(options) => await mintTokenHandler(cctx, options))
    commands.transferCommand.action(async(options) => await transferTokenHandler(cctx, options))
    commands.nativeTransferCommand.action(async(options) => await nativeTransferHandler(cctx, options))
    commands.batchTransfercommand.action(async(options) => await batchTransferHandler(cctx, options))

    commands.poolInfoCommand.action(async(options) => await poolInfo(cctx, options))
    commands.priceCommand.action(async(options) => await getPoolPrice(cctx, options))
    commands.poolStatsCommand.action(async(options) => await getPoolStats(cctx, options))

    commands.poolAddLiquidityCommand.action(async(options) => await depositPoolHandler(cctx, options))

    commands.swapCommand.action(async(options) => await swapITATokenHandler(cctx, options))
    commands.createPoolCommand.action(async(options) => await createPoolHandle(cctx, options))

    commands.strategyBuilderCommand.action(async(options) => await strategyBuilderHandler(cctx, options))
}

main()
program.parse()