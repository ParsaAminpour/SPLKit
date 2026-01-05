import { CliContext } from "@/index";
import { isValidCpmm } from "../../utils/poolUtils"
import { ApiV3PoolInfoStandardItemCpmm, CpmmKeys, Percent } from '@raydium-io/raydium-sdk-v2'
import BN from 'bn.js'
import Decimal from "decimal.js"
import { initSdk, txVersion } from "../../configs/poolConfig";
import consola from "consola";
import { confirmOrExit, depositCallbackMessage } from "../../utils/messageUtils";
import { getUserTokenBalance } from "../readOps/status";
import { Keypair, Transaction, TransactionInstruction, TransactionInstructionCtorFields } from "@solana/web3.js"
import { getPriorityFeeInfo, PriorityLevel } from "../../utils/transactionUtils";
import { loadKeypair } from "../../utils/utils";
import { Result, Ok, Err } from "../../types/share";


export const depositPoolHandler = async(cctx: CliContext, options:any) => {
    // consola.info(`Starting add ${asset} asset liquidity operation: preparing to deposit ${uiInputAmount} to the liquidity pool...`);
    // consola.start(`Adding ${uiInputAmount} to the pool \`${cctx.configs.raydium_pool_id}\``)
    const signer = options.fromKeypair == "admin" ? cctx.configs.admin_wallet_keypair : loadKeypair(options.fromKeypair)
    const depositRes = await depositPool(cctx, signer!, options.amount, options.base, options.slippage, options.priorityLevel, true)
    !depositRes.ok 
      ? depositCallbackMessage(true, undefined, `reason: ${depositRes.error}`) 
      : depositCallbackMessage(false, depositRes.value, undefined)
}

export const depositPool = async (
    cctx: CliContext,
    signer: Keypair,
    uiAmount: number,
    isBase: boolean,
    _slippage?: number,
    _priorityLevel: PriorityLevel = 2,
    askBeforeAction: boolean = false,
): Promise<Result<string>> => {
    const raydium = await initSdk(cctx, undefined, signer)
    const uiInputAmount = new Decimal(uiAmount) 
    // const asset = isBase ? "base" : "quote"

    const poolId = cctx.configs.raydium_pool_id
    let poolInfo: ApiV3PoolInfoStandardItemCpmm
    let poolKeys: CpmmKeys | undefined
    
    if (raydium.cluster === 'mainnet') {
        const data = await raydium.api.fetchPoolById({ ids: poolId })
        poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm
        if (!isValidCpmm(poolInfo.programId)) return Err('target pool is not CPMM pool')
    } else {
        const data = await raydium.cpmm.getPoolInfoFromRpc(poolId)
        poolInfo = data.poolInfo
        poolKeys = data.poolKeys
    }

    const inputAmount = new BN(new Decimal(uiInputAmount).mul(10 ** poolInfo.mintA.decimals).toFixed(0))
    const slippage = _slippage ? new Percent(_slippage, 100) : new Percent(2, 100) // 2%
    const baseIn = true ? isBase : false // base-token ~ ITA Token

    // just for cli display
    const res = await raydium.cpmm.getRpcPoolInfos([poolId]);
    const pool1Info = res[poolId];

    const baseDecimals = poolInfo.mintA.decimals;
    const quoteDecimals = poolInfo.mintB.decimals;
    const fmt = (bnValue: BN, decimals: number, dp = 6) =>
      new Decimal(bnValue.toString()).div(new Decimal(10).pow(decimals)).toFixed(dp);

    const computeRes = await raydium.cpmm.computePairAmount({
      baseReserve: pool1Info.baseReserve,
      quoteReserve: pool1Info.quoteReserve,
      poolInfo,
      amount: uiInputAmount,
      slippage,
      baseIn,
      epochInfo: await raydium.fetchEpochInfo()
    });
    const ITABalance = await getUserTokenBalance(cctx, signer.publicKey);
    const solBalance = await cctx.connection.getBalance(signer.publicKey)

    if (askBeforeAction) {
        console.log("\n")
        consola.info("Pool state before adding liquidity:");
        consola.log(`- LP supply: ${fmt(pool1Info.lpAmount, 9)}`);
        consola.log(`- Base reserve: ${fmt(pool1Info.baseReserve, baseDecimals)}`);
        consola.log(`- Quote reserve: ${fmt(pool1Info.quoteReserve, quoteDecimals)}`);
        consola.log(`- Vault A amount: ${fmt(pool1Info.vaultAAmount, baseDecimals)}`);
        consola.log(`- Vault B amount: ${fmt(pool1Info.vaultBAmount, quoteDecimals)}`);
        consola.log(`- Price: 1 SOL ≈ ${pool1Info.poolPrice.toString().slice(0, 8)} ITA\n`);

        consola.info("Deposit preview based on your input:");
        consola.log(`- You deposit: ${computeRes.inputAmountFee.amount.toNumber() / 1e9} (includes fee)`);
        consola.log(`- Pair amount required: ${computeRes.anotherAmount.amount.toNumber() / 1e9}`);
        consola.log(`- Transfer fee (if any): ${computeRes.inputAmountFee.fee?.toNumber() ?? 0}`);
        consola.log(`- Liquidity to be minted: ${computeRes.liquidity.toString()}\n`)

        consola.log(`- Your ITA Balance: ${ITABalance/1e9} | Your SOL balance: ${solBalance/1e9}`)

        await confirmOrExit(
          "Do you want to continue adding liquidity?",
          "Adding liquidity operation has been terminated"
        )
    }

    // Checking the user blanace despite his answer
    if (isBase) {
        if (solBalance < computeRes.inputAmountFee.amount.toNumber()) return Err("You have not sufficient (SOL) blanace to done this operation")
        if (ITABalance < computeRes.anotherAmount.amount.toNumber())  return Err("You have not sufficient (ITA) blanace to done this operation")
    } else {
        if (ITABalance < computeRes.inputAmountFee.amount.toNumber()) return Err("You have not sufficient (ITA) blanace to done this operation")
        if (solBalance < computeRes.anotherAmount.amount.toNumber()) return Err("You have not sufficient  (SOL) blanace to done this operation")
    }

  const estimate = await getPriorityFeeInfo(cctx.heliusSDK, cctx.configs.ita_token_mint_pda, _priorityLevel)
  if (!estimate.ok) return Err(`There is an error in fetching priority estimation fee\n${estimate.error}`)
  try {
        // computeRes.anotherAmount.amount -> pair amount needed to add liquidity
        // computeRes.anotherAmount.fee -> token2022 transfer fee, might be undefined if isn't token2022 program
        const { execute } = await raydium.cpmm.addLiquidity({
            poolInfo,
            poolKeys,
            inputAmount,
            slippage,
            baseIn,
            txVersion,
            computeBudgetConfig: {
              units: 600000,
              microLamports: estimate.value,
            },
            // optional: add transfer sol to tip account instruction. e.g sent tip to jito
            // txTipConfig: {
            //   address: new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
            //   amount: new BN(10000000), // 0.01 sol
            // },
        })
        const { txId } = await execute({ sendAndConfirm: true })
        return Ok(txId)
    }catch(err) {
        return Err(err as string)
    }
}

export const getDepositPoolIx = async (
  cctx: CliContext,
  signer: Keypair,
  uiAmount: number,
  isBase: boolean,
  _slippage?: number,
  _priorityLevel: PriorityLevel = 2,
): Promise<Result<Transaction | TransactionInstruction | TransactionInstructionCtorFields>> => {
    const raydium = await initSdk(cctx, undefined, signer)
    const uiInputAmount = new Decimal(uiAmount) 
  
    const poolId = cctx.configs.raydium_pool_id
    let poolInfo: ApiV3PoolInfoStandardItemCpmm
    let poolKeys: CpmmKeys | undefined
    
    if (raydium.cluster === 'mainnet') {
        const data = await raydium.api.fetchPoolById({ ids: poolId })
        poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm
        if (!isValidCpmm(poolInfo.programId)) return Err('target pool is not CPMM pool')
    } else {
        const data = await raydium.cpmm.getPoolInfoFromRpc(poolId)
        poolInfo = data.poolInfo
        poolKeys = data.poolKeys
    }
  
    const inputAmount = new BN(new Decimal(uiInputAmount).mul(10 ** poolInfo.mintA.decimals).toFixed(0))
    const slippage = _slippage ? new Percent(_slippage, 100) : new Percent(2, 100) // 2%
    const baseIn = true ? isBase : false // base-token ~ ITA Token
  
    // just for cli display
    const res = await raydium.cpmm.getRpcPoolInfos([poolId]);
    const pool1Info = res[poolId];
  
    const computeRes = await raydium.cpmm.computePairAmount({
        baseReserve: pool1Info.baseReserve,
        quoteReserve: pool1Info.quoteReserve,
        poolInfo,
        amount: uiInputAmount,
        slippage,
        baseIn,
        epochInfo: await raydium.fetchEpochInfo()
    });
    const ITABalance = await getUserTokenBalance(cctx, signer.publicKey);
    const solBalance = await cctx.connection.getBalance(signer.publicKey)
  
    if (isBase) {
        if (solBalance < computeRes.inputAmountFee.amount.toNumber()) return Err("You have not sufficient (SOL) blanace to done this operation")
        if (ITABalance < computeRes.anotherAmount.amount.toNumber())  return Err("You have not sufficient (ITA) blanace to done this operation")
    } else {
        if (ITABalance < computeRes.inputAmountFee.amount.toNumber()) return Err("You have not sufficient (ITA) blanace to done this operation")
        if (solBalance < computeRes.anotherAmount.amount.toNumber()) return Err("You have not sufficient  (SOL) blanace to done this operation")
    }
  
    // const estimate = await getPriorityFeeInfo(cctx.heliusSDK, cctx.configs.ita_token_mint_pda, _priorityLevel)
    // if (!estimate.ok) return Err(`There is an error in fetching priority estimation fee\n${estimate.error}`)
    try {
        const { transaction } = await raydium.cpmm.addLiquidity({
            poolInfo,
            poolKeys,
            inputAmount,
            slippage,
            baseIn,
            txVersion,
            // TODO : add this compute budget later
            // computeBudgetConfig: {
            //   units: 600_000,
            //   microLamports: estimate.value,
            // },
            // optional: add transfer sol to tip account instruction. e.g sent tip to jito
            // txTipConfig: {
            //   address: new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
            //   amount: new BN(10000000), // 0.01 sol
            // },
        })
        return Ok(transaction)
      }catch(err) {
          return Err(err as string)
      }
}