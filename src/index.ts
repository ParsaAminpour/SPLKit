import { program } from "commander";
import { ITAConfiguration } from "./configs/configs";
import { AnchorProvider, Program, web3, Wallet } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor"
import { PublicKey } from "@solana/web3.js";
import { ItaToken } from "./types/ita_token";
import fs from "fs"
import { consola } from "consola"
import { getConfig, setConfig } from "./commands/readOps/configs";
import { configs } from "./commands/readOps/configs";
import * as constant from "./commands/constants"
import { getATABalance } from "./commands/readOps/status"
import { tokenInfo, tokenAccountInfo, getTokeHolders } from "./commands/readOps/status"
import { mintToken } from "./commands/writeOps/mint";
import * as utils from "./utils/utils"
// import { Keypair, PublicKey } from "@solana/web3.js";

export interface CliContext {
    readonly program: Program<anchor.Idl>,
    readonly connection: web3.Connection,
    readonly provider: AnchorProvider,
    readonly itaTokenMintPDA: PublicKey,
    configs: ITAConfiguration
    // getProgramId(): string,
    // getConnectionCluster(): string,
    // getConfigs(): ITAConfiguration
}

// We also provide the primary features via step-by-step prompt back and forth
// TODO : Complete here
program
    .name("ita-toolkit")
    .description("ITA Token tool for token operations")
    .version("0.1.0")
    .action(async() => {
        const answer = await consola.prompt("What brings you here?", {
            type:"select",
            options: [
                "config", 
                "token-info"
            ]
        })
        if (answer == "config") {
            const configAnswer = await consola.prompt("What do you want to do with configs?", {
                type: "select",
                options: [
                    "detail",
                    "set-config"
                ]
            })
            if (configAnswer == "detail") {
                console.table(configs.load())
            }
        }
    })

export const tokenInfoCommand = program.command("token-info")
export const supply = program.command("supply")
export const balanceCommand = program.command("balance").option("-a --address <string>", "address of the wallet for checking balance")
export const tokenAccountInfoCommand = program.command("account-info").option("-a --address <string>", "The token account address you want know about it")
export const topHoldersCommand = program.command("top-holders").description("getting top 10 holders of the token")

export const mintCommand = program.command("mint")
    .option("-t --to <string>", "The address of the receiver")
    .option("-a --amount <number>", "The amount of tokens to mint")
    .description("Mint tokens to a specified address")
    .description("The default and valid destination for minting is admin, if you want to have another destination you should pass the address in --to option, and the admin will transfer it to that address.")

export const burnCommand = program.command("burn")
export const transferCommand = program.command("transfer")
export const batchTransfercommand = transferCommand.command("batch").option("-f --file <string>")
export const createATACommand = program.command("create-account").option("-o --owner <address", "The owner of the Associated Token Account")
export const closeATACommand = program.command("close-account").option("-a --address <string", "The address of Associated Token Account to close for reclaiming rent")
export const setAuthorityCommand = program.command("set-authority").option("-a --address", "The authority address")
 
export const mixerOwnerCommand = program.command("mixer") // with --wallets option

// Operations on Raydium Liquidity Pool
export const poolCommand = program.command("pool")
export const poolInfoCommand = poolCommand.command("info").description("Get Pool Details (reserves, fee, tier, liquidity")
export const poolList = poolCommand.command("list").description("List of all pools containing ITA Token")
export const priceCommand = program.command("price").description("Get current token price from pool")
export const priceHistory = priceCommand.command("history").description("historical price data (24h, 7d, 30d")
export const poolStatsCommand = poolCommand.command("stats").description("Trading volume, fees earned, TVL")
export const poolAPRCommand = poolCommand.command("apr").description("Calculate current APR/APY")
// Raydium Pool Write Operations
export const poolAddLiquidityCommand = poolCommand.command("add").option("--amountA <number>").option("--amountB <number>").description("Add liquidity to CLMM pool")
export const poolRemoveLiquidityCommand = poolCommand.command("remove").option("--position-id <string>") // replace appropriate command for CPMM
export const createPositionCommand = poolCommand.command("create-position")
export const poolCollectFeesCommand = poolCommand.command("collect-fees").description("Claim earned trading fees")
export const poolClosePosition = poolCommand.command("close").option("--position-id <string") // replace appropriate command for CPMM

// Analytics and Monitoring
export const txListCommand = program.command("tx").command("list").description("Recent token transactions")
export const volumeCommand = program.command("volume").description("token trading volume")
export const marketCapCommand = program.command("market-cap").description("calculation market capitalization")
export const tokenomicCommand = program.command("tokenomic").description("Complete tokenomics overview (supply, distribution, lock")
export const holderGrowthCommand = program.command("growth").description("track holder count over time")
export const whaleWatchCommand = program.command("whales").description("Monitor large holders activity")
export const portfolioCommand = program.command("portfolio").description("Your complete ITA token portfolio value")

// Watcher and Alerting 
export const watchPriceCommand = program.command("watch").command("price").description("Real-time monitoring of price")
export const alertPriceCommand = program.command("set") // TODO : implement alert configuration 

// Getting Snapshot
const snapshotCommand = program.command("snapshot")
export const holdersSnapshotCommand = snapshotCommand.command("holders")
export const transactionsSnapshotCommand = snapshotCommand.command("transactions")

// The strategy mean user can define a scheduled action (based on these available operations) in autonomous manner, it's so abstract rn, needs to be complete
export const strategyCommand = program.command("strategy")

// The Cli tool configuration management
export const configCommand = program.command("config")
export const getConfigCommand = configCommand.command("get").description("The config of the tool you are interacting")
export const setConfigCommand = configCommand
    .command("set")
    .option("-c --cluster <string>", "Solana Cluster that tool should use")
    .option("--token-program-id <string>", "The ITA token program ID")
    .option("--token-mint-pda <string>", "ITA Token Mint PDA address")
    .option("--cluster-url <string>", "custom url of the cluster")
    .description("The config of the tool you are interacting")


const setup = (): CliContext => {
    const conf = configs.load()
    consola.info(`Using cluster: ${conf.cluster_url}`)
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

    const cctx: CliContext = {
        program: program,
        connection: connection,
        provider: provider,
        itaTokenMintPDA: itaTokenMintPDA,
        configs: conf
    }
    return cctx
}

const main = async() => {
    const cctx: CliContext = setup()
    getConfigCommand.action(() => getConfig())
    setConfigCommand.action((options) => setConfig(options))

    balanceCommand.action(async(options) => {await getATABalance(cctx, options)})
    // token metadata extracted from Metaplex
    tokenInfoCommand.action(() => tokenInfo(cctx))
    tokenAccountInfoCommand.action(async(options) => await tokenAccountInfo(cctx, options))
    topHoldersCommand.action(async(options) => await getTokeHolders(cctx, options))

    mintCommand.action(async(options) => await mintToken(cctx, options))
}

main()
program.parse()