import { program } from "commander";
import consola = require("consola");
import { configs } from "./readOps/configs";
import { showFailureAndReturn } from "../utils/messageUtils";
import { CliContext } from "@/index";

// We also provide the primary features via step-by-step prompt back and forth
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


// TODO : All the commands have to contain --prior flag for sending transaction with priority fee

// TODO : The pool id should be added to the configs, this allow us to remove the --poolid option from the commands

// ‌TODO : Add pre-action operations for each commands

// TODO : Complete the command descriptions for the user guide

// TODO : showing token stats via diagrams and charts

// TODO : Add winston logger to record all operations logs

export const createCommands = (cctx: CliContext) => {
    const tokenInfoCommand = program.command("token-info") // ✅ Done
    const supply = program.command("supply")
    const balanceCommand = program.command("balance").option("-a --address <string>", "address of the wallet for checking balance") // ✅ Done
    const tokenAccountInfoCommand = program.command("account-info").option("-a --address <string>", "The token account address you want know about it") // ✅ Done
    const topHoldersCommand = program.command("top-holders") // ✅ Done
        .option("-o --output <string>", "write the output to a file with selected path")
        .description("getting top 10 holders of the token")

    const mintCommand = program.command("mint") // ✅ Done
        .option("-t --to <string>", "The address of the receiver")
        .option("-a --amount <number>", "The amount of tokens to mint")
        .description("Mint tokens to a specified address")
        .description("The default and valid destination for minting is admin, if you want to have another destination you should pass the address in --to option, and the admin will transfer it to that address.")

    const transferRawCommand = program.command("transfer") 
    const transferCommand = transferRawCommand // ✅ Done
        .option("-f, --from-keypair <string>", "The sender keypair json file", "admin")
        .option("-t, --to <string>", "The address of the receiver")
        .option("-a, --amount <number>", "The amount of tokens to transfer")
        .description("transfer ITA token from the --from-keypair wallet to the choosen destination")

    const nativeTransferCommand = program.command("transfer-native")
        .option("-f, --from-keypair <string>", "The sender keypair json file", "admin")
        .option("-t, --to <string>", "The address of the receiver")
        .option("-a, --amount <number>", "The amount of tokens to mint")
        .description("transfer SOL from the admin wallet to the chosen destination")

    const batchTransfercommand = transferCommand.command("batch") // ✅ Done
        .option("-f --file <string>")
        .description("transfering SPL token from admin wallet to the wallet accounts declared in the file")

    const burnCommand = program.command("burn")
    const createATACommand = program.command("create-account").option("-o --owner <address", "The owner of the Associated Token Account")
    const closeATACommand = program.command("close-account").option("-a --address <string", "The address of Associated Token Account to close for reclaiming rent")
    const setAuthorityCommand = program.command("set-authority").option("-a --address", "The authority address")

    const mixerOwnerCommand = program.command("mixer") // with --wallets option

    // Operations on Raydium Liquidity Pool
    const poolCommand = program.command("pool")
    const poolInfoCommand = poolCommand.command("info") // ✅ Done
        .option("--poolid <string>", "The Raydium Pool ID related to your token", cctx.configs.raydium_pool_id)
        .description("Get Whole Pool Details (reserves, fee, tier, liquidity")

    const priceCommand = program.command("price") // ✅ Done
        .option("--poolid <string>", "The Raydium Pool ID related to your token")
        .description("Get current token price from pool")

    const poolStatsCommand = poolCommand.command("stats") // ✅ Done
        .option("--poolid <string>", "The Raydium Pool ID related to your token")
        .description("Trading volume, fees earned, TVL")

    const priceHistory = priceCommand.command("history")
        .option("--poolid <string>", "The Raydium Pool ID related to your token")
        .description("historical price data (24h, 7d, 30d)")

    const poolList = poolCommand.command("list").description("List of all pools containing ITA Token")

    // const poolAPRCommand = poolCommand.command("apr").description("Calculate current APR/APY")

    // Raydium Pool Write Operations
    const poolAddLiquidityCommand = poolCommand.command("add") // ✅ Done
        .requiredOption("--amount <number>", "amount of token you want to add to the liquidity pool, should be in normal format like 1 base token if you want to add one")
        .requiredOption("--base", "is this amount associated to the base asset or not")
        .option("--quote", "is this amount associated to the quote asset or not")
        .option("--slippage <number>", "Slippage for adding liquidity in ui format like 2.5 or 3 without any percentage icon, default is 2.5(%)")
        .hook("preAction", (thisCommand) => {
            const opts = thisCommand.opts();
            const isBase = !!opts.base;
            const isQuote = !!opts.quote;
            if (isBase === isQuote) showFailureAndReturn("You must specify exactly one of --base or --quote (but not both).");
        })
        .description("Add liquidity to CLMM pool")

    const createPoolCommand = poolCommand.command("create-position") // ✅ Done
        .option("--amountA <number>")
        .option("--amountB <number>")
        .description("create a CPMM liquidity pool for the ITA Token")

    const swapCommand = program.command("swap") // ✅ Done
        .requiredOption("--amount <amount>", "Amount to swap", (value) => parseFloat(value))
        .option("-p --payer <string>", "The payer of the transaction", "admin")
        .option("-s --slippage <slippage>", "Slippage for the swap")
        .requiredOption("--base")
        .description("Swap ITA Token with SOL or vice versa using the Raydium CPMM liquidity pool")

    const poolRemoveLiquidityCommand = poolCommand.command("remove").option("--position-id <string>") // replace appropriate command for CPMM
    const poolCollectFeesCommand = poolCommand.command("collect-fees").description("Claim earned trading fees")
    const poolClosePosition = poolCommand.command("close").option("--position-id <string>") // replace appropriate command for CPMM

    // Analytics and Monitoring
    const txListCommand = program.command("tx").command("list").description("Recent token transactions")
    const volumeCommand = program.command("volume").description("token trading volume")
    const marketCapCommand = program.command("market-cap").description("calculation market capitalization")
    const tokenomicCommand = program.command("tokenomic").description("Complete tokenomics overview (supply, distribution, lock")
    const holderGrowthCommand = program.command("growth").description("track holder count over time")
    const whaleWatchCommand = program.command("whales").description("Monitor large holders activity")
    const portfolioCommand = program.command("portfolio").description("Your complete ITA token portfolio value")

    // Watcher and Alerting
    const watchPriceCommand = program.command("watch").command("price").description("Real-time monitoring of price")
    const alertPriceCommand = program.command("set") // TODO : implement alert configuration 

    // Getting Snapshot
    const snapshotCommand = program.command("snapshot")
    const holdersSnapshotCommand = snapshotCommand.command("holders")
    const transactionsSnapshotCommand = snapshotCommand.command("transactions")

    // The strategy mean user can define a scheduled action (based on these available operations) in autonomous manner, it's so abstract rn, needs to be complete
    const strategyBuilderCommand = program.command("strategy")
        .requiredOption("-f --file <path>", "Path to the strategy file containing operations to execute")
        .option("-s --schedule", "Enable scheduling mode - operations with timeToExecute will be scheduled")
        .option("-d --delay", "Executing each operation with a specific delay, the format should be in second")
        .hook("preAction", (thisCommand) => {
            const opts = thisCommand.opts();
            if (opts.schedule && opts.delay) {
                showFailureAndReturn("Cannot use --schedule and --delay flags simultaneously. Please choose one execution mode.");
            }
        })
        .description(`
    Execute a batch of operations defined in a strategy file.

    Strategy File Format:
      Operations are separated by semicolons (;) and follow these patterns:
        
      mintTo: <destinationAccount> <amount> [timeToExecute]
      transfer: <fromKp> <toPk> <amount> [timeToExecute]
      swap: <inputMintPDA> <outputMintPDA> <callerKp> <amount> [timeToExecute]
        
      Where:
        - destinationAccount: Public key address for mint destination
        - fromKp/toPk: Public key addresses for transfer
        - inputMintPDA/outputMintPDA: Mint PDA addresses for swap
        - callerKp/fromKp: File path to keypair JSON file
        - amount: Token amount (in raw format, considering decimals)
        - timeToExecute: Optional timestamp (Unix epoch in seconds) - only used with --schedule flag
        
      Example strategy file content:
        mintTo;7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU;1000000
        transfer;./wallets/wallet1.json;7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU;500000
        swap;So11111111111111111111111111111111111111112;7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU;./wallets/wallet2.json;1000000;1735689600
        
      Note: When --schedule flag is used, operations with timeToExecute will be queued for execution at the specified time.
            Operations without timeToExecute will execute immediately regardless of the flag.
            It's recommended to run this tool on an external server if you want to scheduling the tasks.
        `)

    const predict = program.command("predict")
        .option("-d --direction [DIRECTION]", "predict for buy or sell", "buy")
        .option("--amount-in <number>", "amount of token you want to buy or sell to predict the new price")

    // The Cli tool configuration management
    const configCommand = program.command("config")
    const getConfigCommand = configCommand.command("get").description("The config of the tool you are interacting")
    const setConfigCommand = configCommand
        .command("set")
        .option("-c --cluster <string>", "Solana Cluster that tool should use")
        .option("--token-program-id <string>", "The ITA token program ID")
        .option("--token-mint-pda <string>", "ITA Token Mint PDA address")
        .option("--poolid <string>", "ITA Token Create CPMM Pool ID on Raydium")
        .option("--cluster-url <string>", "custom url of the cluster")
        .description("The config of the tool you are interacting")
    
    return {
        tokenInfoCommand,
        supply,
        balanceCommand,
        tokenAccountInfoCommand,
        topHoldersCommand,
        mintCommand,
        transferCommand,
        batchTransfercommand,
        nativeTransferCommand,
        burnCommand,
        createATACommand,
        closeATACommand,
        setAuthorityCommand,
        mixerOwnerCommand,
        poolCommand,
        poolInfoCommand,
        priceCommand,
        poolStatsCommand,
        priceHistory,
        poolList,
        poolAddLiquidityCommand,
        createPoolCommand,
        swapCommand,
        poolRemoveLiquidityCommand,
        poolCollectFeesCommand,
        poolClosePosition,
        txListCommand,
        volumeCommand,
        marketCapCommand,
        tokenomicCommand,
        holderGrowthCommand,
        whaleWatchCommand,
        portfolioCommand,
        watchPriceCommand,
        alertPriceCommand,
        holdersSnapshotCommand,
        transactionsSnapshotCommand,
        strategyBuilderCommand,
        predict,
        configCommand,
        getConfigCommand,
        setConfigCommand,
    }
}