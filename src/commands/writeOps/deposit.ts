import { CliContext } from "@/index";
import { isValidCpmm } from "../../utils/poolUtils"
import { ApiV3PoolInfoStandardItemCpmm, CpmmKeys, Percent } from '@raydium-io/raydium-sdk-v2'
import BN from 'bn.js'
import Decimal from "decimal.js"
import { initSdk, txVersion } from "../../configs/poolConfig";
import consola from "consola";
import { explorerLink, showFailureAndReturn, showInfo, showSuccess } from "../../utils/messageUtils";
import { getUserTokenBalance } from "../readOps/status";

export const depositToPool = async(cctx: CliContext, options: any) => {
    if (!options.amount) showFailureAndReturn("defining --amount is mandatory")
    if (options.slippage > 50) showFailureAndReturn("You can not set slippage above 50$")

    const raydium = await initSdk(cctx)
    const uiInputAmount = options.amount
    const asset = options.base ? "base" : "quote"
    consola.info(`Starting add ${asset} asset liquidity operation: preparing to deposit ${uiInputAmount} to the liquidity pool...`);

    consola.start(`Adding ${uiInputAmount} to the pool \`${cctx.configs.raydium_pool_id}\``)
    const poolId = cctx.configs.raydium_pool_id
    let poolInfo: ApiV3PoolInfoStandardItemCpmm
    let poolKeys: CpmmKeys | undefined
  
    if (raydium.cluster === 'mainnet') {
      const data = await raydium.api.fetchPoolById({ ids: poolId })
      poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm
      if (!isValidCpmm(poolInfo.programId)) throw new Error('target pool is not CPMM pool')
    } else {
      const data = await raydium.cpmm.getPoolInfoFromRpc(poolId)
      poolInfo = data.poolInfo
      poolKeys = data.poolKeys
    }

    const inputAmount = new BN(new Decimal(uiInputAmount).mul(10 ** poolInfo.mintA.decimals).toFixed(0))
    const slippage = options.slippage ? new Percent(options.slippage, 100) : new Percent(2, 100) // 1%
    const baseIn = true ? options.base : false // base-token ~ ITA Token

    // computePairAmount is not necessary, addLiquidity will compute automatically,
    // just for ui display
    const res = await raydium.cpmm.getRpcPoolInfos([poolId]);
    const pool1Info = res[poolId];

    const baseDecimals = poolInfo.mintA.decimals;
    const quoteDecimals = poolInfo.mintB.decimals;
    const fmt = (bnValue: BN, decimals: number, dp = 6) =>
      new Decimal(bnValue.toString()).div(new Decimal(10).pow(decimals)).toFixed(dp);

    console.log("\n")
    consola.info("Pool state before adding liquidity:");
    consola.log(`- LP supply: ${fmt(pool1Info.lpAmount, 9)}`);
    consola.log(`- Base reserve: ${fmt(pool1Info.baseReserve, baseDecimals)}`);
    consola.log(`- Quote reserve: ${fmt(pool1Info.quoteReserve, quoteDecimals)}`);
    consola.log(`- Vault A amount: ${fmt(pool1Info.vaultAAmount, baseDecimals)}`);
    consola.log(`- Vault B amount: ${fmt(pool1Info.vaultBAmount, quoteDecimals)}`);
    consola.log(`- Price: 1 SOL ≈ ${pool1Info.poolPrice.toString().slice(0, 8)} ITA\n`);

    const computeRes = await raydium.cpmm.computePairAmount({
      baseReserve: pool1Info.baseReserve,
      quoteReserve: pool1Info.quoteReserve,
      poolInfo,
      amount: uiInputAmount,
      slippage,
      baseIn,
      epochInfo: await raydium.fetchEpochInfo()
    });
    consola.info("Deposit preview based on your input:");
    consola.log(`- You deposit: ${computeRes.inputAmountFee.amount.toNumber() / 1e9} (includes fee)`);
    consola.log(`- Pair amount required: ${computeRes.anotherAmount.amount.toNumber() / 1e9}`);
    consola.log(`- Transfer fee (if any): ${computeRes.inputAmountFee.fee?.toNumber() ?? 0}`);
    consola.log(`- Liquidity to be minted: ${computeRes.liquidity.toString()}\n`)

    const adminKeypair = cctx.configs.admin_wallet_keypair;
    if (!adminKeypair) showFailureAndReturn("Admin wallet keypair is missing in configs");
    const ITABalance = await getUserTokenBalance(cctx, adminKeypair!.publicKey);
    const solBalance = await cctx.connection.getBalance(adminKeypair!.publicKey)
    consola.log(`- Your ITA Balance: ${ITABalance/1e9} | Your SOL balance: ${solBalance/1e9}`)
    
    const answer = await consola.prompt("Do you want to continue adding liquidity?", {
        type: "select",
        options: [
            "yes", "no"
        ]
    })
    if (answer == "no") {
        showInfo("Adding liquidity operation has been terminated")
        process.exit(0)
    }
    // Checking the user blanace despite his answer
    if (options.base) {
        if (solBalance < computeRes.inputAmountFee.amount.toNumber()) showFailureAndReturn("You have not sufficient (SOL) blanace to done this operation")
        if (ITABalance < computeRes.anotherAmount.amount.toNumber())  showFailureAndReturn("You have not sufficient (ITA) blanace to done this operation")
    }
    if (options.quote) { 
        if (ITABalance < computeRes.inputAmountFee.amount.toNumber()) showFailureAndReturn("You have not sufficient (ITA) blanace to done this operation")
        if (solBalance < computeRes.anotherAmount.amount.toNumber()) showFailureAndReturn("You have not sufficient  (SOL) blanace to done this operation")
    }

    // computeRes.anotherAmount.amount -> pair amount needed to add liquidity
    // computeRes.anotherAmount.fee -> token2022 transfer fee, might be undefined if isn't token2022 program
    const { execute } = await raydium.cpmm.addLiquidity({
        poolInfo,
        poolKeys,
        inputAmount,
        slippage,
        baseIn,
        txVersion,
        // priority fee here
        // computeBudgetConfig: {
        //   units: 600000,
        //   microLamports: 46591500,
        // },
    
        // optional: add transfer sol to tip account instruction. e.g sent tip to jito
        // txTipConfig: {
        //   address: new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
        //   amount: new BN(10000000), // 0.01 sol
        // },
    })
    // don't want to wait confirm, set sendAndConfirm to false or don't pass any params to execute
    const { txId } = await execute({ sendAndConfirm: true })
    showSuccess(`pool deposited ${explorerLink(txId, cctx.configs.cluster)}`)
}