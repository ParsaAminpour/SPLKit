import { program } from "commander";
import consola from "consola";
import { configs } from "./readOps/configs";
import { showFailureAndReturn, showWarning } from "../utils/messageUtils";
import { CliContext } from "@/index";
import fs from "fs"

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


// TODO : We need more graceful and user-friendly error handling
// TODO : Set timeout for ext requests
// ‌TODO : Add pre-action operations for each commands

export const createCommands = (cctx: CliContext) => {
    const tokenInfoCommand = program.command("token-info")
        .description("Show ITA token metadata: mint address, supply (raw + ui), holder count, authorities, and metadata PDA")
        
    const balanceCommand = program.command("balance")
        .requiredOption("-a --address <string>", "Wallet owner public key to check (not the ATA)")
        .description("Show ITA token balance for the provided wallet owner address; outputs human-readable amount using token decimals")
        
    const tokenAccountInfoCommand = program.command("account-info")
        .requiredOption("-a --address <string>", "Wallet owner public key; the ATA will be derived")
        .description("Show the associated token account (ATA) for the provided wallet owner")
    
    const topHoldersCommand = program.command("top-holders")
        .option("-n --number <number>", "Number of top holders to show (default: 10, whole holders: 0)", "10")
        .option("-o --output <string>", "write the output to a file with selected path")
        .description("List top 10 ITA token holders with balances; optionally write to file via --output")
        .hook("preAction", (thisCommand) => {
            const opts = thisCommand.opts()
            if (Number(opts.number) <= 0) showFailureAndReturn("The value for --number must be a positive integer")
        })

    const mintCommand = program.command("mint")
        .requiredOption("-t --to <string>", "Recipient address; omit to mint to the admin wallet")
        .requiredOption("-a --amount <number>", "Amount to mint (UI units, e.g., 1 = one whole token)")
        // .option("--priority-level <number>", "Priority fee level: 0=LOW, 1=MEDIUM (default), 2=HIGH, 3=VERY_HIGH, 4=UNSAFE_MAX")
        .description("Mint ITA tokens to a recipient (defaults to admin if --to is not provided)")

    const transferRawCommand = program.command("transfer")
    const transferCommand = transferRawCommand
        .option("-f, --from-keypair <string>", "Sender keypair JSON path (defaults to admin)", "admin")
        .requiredOption("-t, --to <string>", "Recipient wallet address (owner, not ATA)")
        .requiredOption("-a, --amount <number>", "Amount to transfer in UI units (e.g., 1 = one whole token)")
        .option("--priority-level <number>", "Priority fee level: 0=LOW, 1=MEDIUM (default), 2=HIGH, 3=VERY_HIGH, 4=UNSAFE_MAX", "1")
        .description("Transfer ITA tokens from the specified sender (default admin) to the recipient")
        .hook("preAction", (thisCommand) => {
            const opts = thisCommand.opts();
            if (![0, 1, 2, 3, 4].includes(Number(opts.priorityLevel))) {
                showFailureAndReturn("Invalid value for --priority-level. Allowed values are 0=LOW, 1=MEDIUM, 2=HIGH, 3=VERY_HIGH, 4=UNSAFE_MAX.");
            }
        })

    const nativeTransferCommand = program.command("transfer-native")
        .option("-f, --from-keypair <string>", "Sender keypair JSON path (defaults to admin)", "admin")
        .requiredOption("-t, --to <string>", "Recipient wallet address")
        .requiredOption("-a, --amount <number>", "Amount of SOL to send (in SOL, e.g., 0.1)")
        .option("--priority-level <number>", "Priority fee level: 0=LOW, 1=MEDIUM (default), 2=HIGH, 3=VERY_HIGH, 4=UNSAFE_MAX", "1")
        .description("Transfer SOL from the specified sender (default admin) to the recipient wallet")
        .hook("preAction", (thisCommand) => {
            const opts = thisCommand.opts();
            if (![0, 1, 2, 3, 4].includes(Number(opts.priorityLevel))) {
                showFailureAndReturn("Invalid value for --priority-level. Allowed values are 0=LOW, 1=MEDIUM, 2=HIGH, 3=VERY_HIGH, 4=UNSAFE_MAX.");
            }
        })

    const batchTransfercommand = transferCommand.command("batch")
        .requiredOption("-f --file <string>", "Path to CSV/JSON list of recipients and amounts")
        .option("--priority-level <number>", "Priority fee level: 0=LOW, 1=MEDIUM (default), 2=HIGH, 3=VERY_HIGH, 4=UNSAFE_MAX", "1")       
        .description("Batch transfer ITA tokens from admin to recipients listed in file")
        .hook("preAction", (thisCommand) => {
            const opts = thisCommand.opts();
            if (![0, 1, 2, 3, 4].includes(Number(opts.priorityLevel))) {
                showFailureAndReturn("Invalid value for --priority-level. Allowed values are 0=LOW, 1=MEDIUM, 2=HIGH, 3=VERY_HIGH, 4=UNSAFE_MAX.");
            }
        })

    const setAuthorityCommand = program.command("set-authority").option("-a --address", "The authority address")

    // Operations on Raydium Liquidity Pool
    const poolCommand = program.command("pool")
    const poolInfoCommand = poolCommand.command("info") 
        .option("--poolid <string>", "The Raydium Pool ID related to your token", cctx.configs.raydium_pool_id)
        .description("Show full pool details: reserves, fee tier, liquidity, and pool config")

    const priceCommand = program.command("price") 
        .option("--poolid <string>", "The Raydium Pool ID related to your token", cctx.configs.raydium_pool_id)
        .description("Get current ITA price from the Raydium pool (quote/base)")

    const poolStatsCommand = poolCommand.command("stats") 
        .option("--poolid <string>", "The Raydium Pool ID related to your token", cctx.configs.raydium_pool_id)
        .description("Show pool stats: volume, fees earned, TVL over recent periods")

    const priceHistory = priceCommand.command("history")
        .option("--poolid <string>", "The Raydium Pool ID related to your token", cctx.configs.raydium_pool_id)
        .description("historical price data (24h, 7d, 30d)")

    const poolList = poolCommand.command("list").description("List of all pools containing ITA Token")

    // Raydium Pool Write Operations
    const poolAddLiquidityCommand = poolCommand.command("add") 
        .requiredOption("--amount <number>", "amount of token you want to add to the liquidity pool, should be in normal format like 1 base token if you want to add one")
        .requiredOption("-f --from-keypair <string>", "Sender keypair JSON path (defaults to admin)")
        .option("--base", "is this amount associated to the base asset or not")
        .option("--quote", "is this amount associated to the quote asset or not")
        .option("--slippage <number>", "Slippage for adding liquidity in ui format like 2.5 or 3 without any percentage icon, default is 2.5(%)")
        .option("--priority-level <number>", "Priority fee level: 0=LOW, 1=MEDIUM (default), 2=HIGH, 3=VERY_HIGH, 4=UNSAFE_MAX", "1")
        .hook("preAction", (thisCommand) => {
            const opts = thisCommand.opts();
            const isBase = !!opts.base;
            const isQuote = !!opts.quote;
            if (isBase === isQuote) showFailureAndReturn("You must specify exactly one of --base or --quote (but not both).");
            if (![0, 1, 2, 3, 4].includes(Number(opts.priorityLevel))) {
                showFailureAndReturn("Invalid value for --priority-level. Allowed values are 0=LOW, 1=MEDIUM, 2=HIGH, 3=VERY_HIGH, 4=UNSAFE_MAX.");
            }
        })
        .description("Add liquidity to the Raydium CPMM pool on either the base or quote side with optional slippage control")

    const createPoolCommand = poolCommand.command("create-position") 
        .requiredOption("--amountA <number>")
        .requiredOption("--amountB <number>")
        .description("Create a new Raydium CPMM position for ITA with provided token amounts")

    const swapCommand = program.command("swap") 
        .requiredOption("--amount <amount>", "Amount to swap", (value) => parseFloat(value))
        .requiredOption("--base", "Is the swap initiated from base asset (ITA) side? (set if swapping from ITA, omit if swapping from SOL)")
        .option("-p --payer <string>", "The payer of the transaction", "admin")
        .option("-s --slippage <slippage>", "Slippage for the swap")
        .option("--priority-level <number>", "Priority fee level: 0=LOW, 1=MEDIUM (default), 2=HIGH, 3=VERY_HIGH, 4=UNSAFE_MAX", "1")
        .description("Swap ITA <-> SOL through the Raydium CPMM pool with optional slippage control; payer defaults to admin")

    const poolRemoveLiquidityCommand = poolCommand.command("remove").option("--position-id <string>") // replace appropriate command for CPMM
    const poolCollectFeesCommand = poolCommand.command("collect-fees").description("Claim earned trading fees")

    // Analytics and Monitoring
    const marketCapCommand = program.command("market-cap").description("calculation market capitalization")
    const tokenomicCommand = program.command("tokenomic").description("Complete tokenomics overview (supply, distribution, lock")
    const whaleWatchCommand = program.command("whales").description("Monitor large holders activity")
    const portfolioCommand = program.command("portfolio").description("Your complete ITA token portfolio value")

    // Watcher and Alerting
    const watchPriceCommand = program.command("watch").command("price").description("Real-time monitoring of price")
    const alertPriceCommand = program.command("set") // TODO : implement alert configuration 

    // Getting Snapshot
    const snapshotCommand = program.command("snapshot")
    const holdersSnapshotCommand = snapshotCommand.command("holders")
        .requiredOption("-o --output <output>", "File path to save the holders snapshot output")
        .description("Export a snapshot of all current ITA token holders (addresses and balances) to a specified file")
        .hook("preAction", (thisCommand) => {
            const opts = thisCommand.opts()
            if (!fs.existsSync(opts.output)) showFailureAndReturn("The specified output file path does not exist. Please provide a valid path to save the holders snapshot output.");
        })
    const transactionsSnapshotCommand = snapshotCommand.command("transactions")
        .requiredOption("-n --number <number>", "Number of transaction to get snapshot (starts from latest one), set 0 for getting all recorded transactions")
        .requiredOption("-o --output <output>", "File path to save the transactions snapshot output")
        .description("Export a snapshot of recent ITA token transactions. Specify number of latest transactions to include in the snapshot.")
        .hook("preAction", (thisCommand) => {
            const opts = thisCommand.opts()
            if (!fs.existsSync(opts.output)) showFailureAndReturn("The specified output file path does not exist. Please provide a valid path to save the transactions snapshot output.");
        })

    // The strategy mean user can define a scheduled action (based on these available operations) in autonomous manner, it's so abstract rn, needs to be complete
    const strategyBuilderCommand = program.command("strategy")
        .requiredOption("-f --file <path>", "Path to the strategy file containing operations to execute")
        .option("-s --schedule <number>", "Enable scheduling mode - operations with timeToExecute will be scheduled")
        .option("-d --delay <number>", "Executing each operation with a specific delay, the format should be in second")
        .option("--starts-with <string>", "Strating iterating the operations with a specific operation ID")
        .option("-v --verbose", "Enable verbose output (prints detailed logs of each operation in batch strategy mode)")
        .hook("preAction", (thisCommand) => {
            const opts = thisCommand.opts();
            if (opts.schedule && opts.delay) {
                showFailureAndReturn("Cannot use --schedule and --delay flags simultaneously. Please choose one execution mode.");
            }
        })
        .description(`
    Execute a batch of operations defined in a JSON strategy file (mandatory).

    File format (array of operations):
      [
        {
          "id": "unique-op-id",
          "operation": "mintTo",
          "destinationAccount": "<pubkey>",
          "amount": <number>,              // raw amount (respect token decimals)
          "priorityLevel": <number>,       // optional, default is 2 which means MEDIUM priority level
          "timeToExecute": <unix_ts?>      // optional, seconds, used with --schedule
        },
        {
          "id": "unique-op-id",
          "operation": "transfer",
          "assetPDA": "<mintPDA>",
          "fromKp": "<path/to/sender.json>",
          "toPk": "<recipientPubkey>",
          "amount": <number>,
          "priorityLevel": <number>,
          "timeToExecute": <unix_ts?>
        },
        {
          "id": "unique-op-id",
          "operation": "swap",
          "inputMintPDA": "<mintPDA_in>",
          "outputMintPDA": "<mintPDA_out>",
          "callerKp": "<path/to/payer.json>",
          "amount": <number>,
          "priorityLevel": <number>,
          "timeToExecute": <unix_ts?>
        }
      ]

    Execution modes:
      --schedule : queue ops with timeToExecute for later; others run immediately.
      --delay    : run ops sequentially with the given delay (seconds) between them.

    Tip: Run scheduling on a reliable host; ensure keypair paths and PDAs are valid.
        `)

    const predictRawCommand = program.command("predict")
    const pricePredict = predictRawCommand.command("price")
        .requiredOption("-d --direction [DIRECTION]", "predict for buy or sell ITA token", "buy")
        .requiredOption("--amount-in <number>", "amount of token you want to buy or sell to predict the new price (raw amount, respect token decimals)")
        .option("--base", "Specify if the amount-in is for the base token (SOL)")
        .option("--quote", "Specify if the amount-in is for the quote token (ITA)")
        .hook("preAction", (thisCommand) => {
            const opts = thisCommand.opts();
            if (opts.base && opts.quote) {
                showFailureAndReturn("Cannot specify both --base and --quote. Please use only one to indicate the token type for amount-in.");
            }
            if (!opts.base && !opts.quote) {
                showFailureAndReturn("You must specify either --base or --quote to indicate the token type for amount-in.");
            }
            if (Number(opts.amountIn) < 1e5) {
                showWarning("Warning: The amount-in you provided is very small. Did you remember to use the correct decimals for your token? This may cause the prediction to be inaccurate.");
            }
        })

    // The Cli tool configuration management
    const configCommand = program.command("config")
    const getConfigCommand = configCommand.command("get")
        .option("-s --sensitive", "Showing sensitive data")
        .description("Show the current CLI configuration (cluster, mint PDA, pool id, endpoints) so you can confirm settings before running commands")
        
    const setConfigCommand = configCommand
        .command("set")
        .option("-c --cluster <string>", "Solana Cluster that tool should use")
        .option("--token-program-id <string>", "The ITA token program ID")
        .option("--token-mint-pda <string>", "ITA Token Mint PDA address")
        .option("--poolid <string>", "ITA Token Create CPMM Pool ID on Raydium")
        .option("--cluster-url <string>", "custom url of the cluster")
        .option("--helius-api-key <string>", "Your Helius API key")
        .hook("preAction", (thisCommand) => {
            const opts = thisCommand.opts();
            if (opts.cluster && (opts.cluster !== "devnet" && opts.cluster !== "mainnet")) showFailureAndReturn("Invalid cluster. Allowed values are 'devnet' or 'mainnet'.");
            if (opts.clusterUrl && opts.cluster == "devnet") {
                if (!opts.clusterUrl.includes("devnet")) showFailureAndReturn("Invalid cluster-url. It must contain the keyword 'devnet'.");
            } else if (opts.clusterUrl && opts.cluster == "mainnet") {
                if (opts.clusterUrl.includes("devnet")) showFailureAndReturn("Invalid cluster-url. It must contain the keyword 'devnet'.");
            }
        })
        .description("Update CLI configuration (cluster, token program/mint PDAs, Raydium pool id, custom RPC). Validates cluster and RPC url to avoid mismatched environments.")
    
    return {
        tokenInfoCommand,
        balanceCommand,
        tokenAccountInfoCommand,
        topHoldersCommand,
        mintCommand,
        transferCommand,
        batchTransfercommand,
        nativeTransferCommand,
        setAuthorityCommand,
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
        marketCapCommand,
        tokenomicCommand,
        whaleWatchCommand,
        portfolioCommand,
        watchPriceCommand,
        alertPriceCommand,
        holdersSnapshotCommand,
        transactionsSnapshotCommand,
        strategyBuilderCommand,
        pricePredict,
        configCommand,
        getConfigCommand,
        setConfigCommand,
    }
}