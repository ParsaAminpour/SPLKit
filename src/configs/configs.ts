import path from "path"
import fs from "fs"
import { default_configs } from "./default"
import { Keypair } from "@solana/web3.js"
import * as utils from "../utils/utils"

export interface ITAConfiguration {
    cluster: string,
    ita_token_program_id: string,
    ita_token_mint_pda: string,
    raydium_pool_id: string,
    admin_wallet_keypair?: Keypair,
    cluster_url: string,
    helius_api_key: string,
}

export class ConfigManager {
    private localConfigPath: string

    constructor() {
        this.localConfigPath = path.join(process.cwd(), "ita-cli.config.json")
    }

    public load(): ITAConfiguration {
        let localConfig = this.loadLocalConfig()
        return localConfig
    }

    private loadLocalConfig(): ITAConfiguration {
        if (fs.existsSync(this.localConfigPath)) {
            let conf = JSON.parse(fs.readFileSync(this.localConfigPath, "utf-8")) as ITAConfiguration
            Object.entries(conf).forEach(([key, val]) => {
                if (val == "") throw new Error(`local configuration has not ${key}, please complete the local configuration json file first`) 
            })
            conf.admin_wallet_keypair = utils.getAdminKeypair()
            if (!conf.cluster_url) {
                conf.cluster_url = conf.cluster == "devnet" ? "https://api.devnet.solana.com" : " https://api.solana.com"
            }
            return conf
        } else {
            return this.loadDefaultConfig()
        }
    }

    private loadDefaultConfig(): ITAConfiguration {
        Object.entries(default_configs).forEach(([key, value]) => {
            if (value == "") throw new Error(`default value has not ${key}, please complete the default value if you don't use local config`)
        })
        return default_configs
    }

    public setCustomConfig(
        _cluster?: string,
        _ita_token_program_id?: string,
        _ita_token_mint_pda?: string,
        _raydium_pool_id?: string,
        _cluster_url?: string,
        _helius_api_key?: string,
    ): ITAConfiguration {
        let conf: ITAConfiguration
        if (fs.existsSync(this.localConfigPath)) {
            conf = JSON.parse(fs.readFileSync(this.localConfigPath, "utf-8"))
            if (_cluster) conf.cluster = _cluster
            if (_ita_token_program_id) conf.ita_token_program_id = _ita_token_program_id
            if (_ita_token_mint_pda) conf.ita_token_mint_pda = _ita_token_mint_pda
            if (_cluster_url) conf.cluster_url = _cluster_url
            if (_helius_api_key) conf.helius_api_key = _helius_api_key
        } else {
            throw new Error("configuration file (ita-cli.config.json) doesn't exist")
        }

        fs.writeFileSync(this.localConfigPath, JSON.stringify(conf, null, 2))
        return conf
    }
}