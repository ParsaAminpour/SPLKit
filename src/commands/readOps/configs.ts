import { ConfigManager } from "../../configs/configs"
import consola from "consola"
import { ITAConfiguration } from "../../configs/configs"

export const configs = new ConfigManager()

export const getConfig = (options: any) => {
    const conf = configs.load()
    consola.start("Loaded configuration:");
    console.table({
        cluster: conf.cluster,
        tokenProgramId: conf.ita_token_program_id,
        tokenMintPda: conf.ita_token_mint_pda,
        raydiumPoolID: conf.raydium_pool_id,
        adminWallet: conf.admin_wallet_keypair?.publicKey.toString(),
        clusterURL: options.sensitive ? conf.cluster_url : "**********",
        heliusAPIKey: options.sensitive ? conf.helius_api_key : "**********",
    });
}

export const setConfig = (options: any) => {
    let newConf: ITAConfiguration
    try {
        newConf = configs.setCustomConfig(
            options.cluster,
            options.tokenProgramId,
            options.tokenMintPda,
            options.poolid,
            options.clusterUrl,
            options.heliusApiKey
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
        raydiumPoolID: newConf.raydium_pool_id,
        adminWallet: newConf.admin_wallet_keypair?.publicKey,
        clusterUrl: newConf.cluster_url
    });
}