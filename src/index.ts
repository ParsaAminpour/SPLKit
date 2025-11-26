import { program } from "commander";
import { ConfigManager, ITAConfiguration } from "./configs/configs";

const configs = new ConfigManager()

program
    .name("ita-toolkit")
    .description("ITA Token tool for token operations")
    .version("0.1.0")

const configCommand = program.command("config")

configCommand
    .command("get")
    .description("The config of the tool you are interacting")
    .action(() => {
        const conf = configs.load()

        console.log("Loaded configuration:");
        console.table({
            cluster: conf.cluster,
            tokenProgramId: conf.ita_token_program_id,
            tokenMintPda: conf.ita_token_mint_pda,
            adminWallet: conf.admin_wallet_address,
        });
    })

configCommand
    .command("set")
    .option("-c --cluster <string>", "Solana Cluster that tool should use")
    .option("--token-program-id <string>", "The ITA token program ID")
    .option("--token-mint-pda <string>", "ITA Token Mint PDA address")
    .option("--admin-wallet <string>", "Admin wallet address")
    .description("The config of the tool you are interacting")
    .action((options) => {
        let newConf: ITAConfiguration
        console.log("options: ", options)
        try {
            newConf = configs.setCustomConfig(
                options.cluster,
                options.tokenProgramId,
                options.tokenMintPda,
                options.adminWallet
            )
        } catch(error) {
            console.error("There is an error in setting configuration\n", error)
            return
        }

        console.log("New configuration:");
        console.table({
            cluster: newConf.cluster,
            tokenProgramId: newConf.ita_token_program_id,
            tokenMintPda: newConf.ita_token_mint_pda,
            adminWallet: newConf.admin_wallet_address,
        });
    })

program.parse()