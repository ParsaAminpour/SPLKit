import { program } from "commander";
import * as configs from "../src/configs/configs"

program
    .name("ita-toolkit")
    .description("ITA Token tool for token operations")
    .version("0.1.0")


program
    .command("config")
    .description("The config of the tool you are interacting")
    .action(() => {
        console.log("The config is: " + configs.ITA_TOKEN_TESTNET)
    })

program.parse()