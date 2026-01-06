import {
    ApiV3PoolInfoStandardItemCpmm,
    CpmmKeys,
    CpmmParsedRpcData,
    CurveCalculator,
    FeeOn,
    TxVersion,
  } from '@raydium-io/raydium-sdk-v2'
import BN from 'bn.js'
import { isValidCpmm } from '../../utils/poolUtils'
import { NATIVE_MINT } from '@solana/spl-token'
import { Raydium } from '@raydium-io/raydium-sdk-v2'
import { initSdk } from '../../configs/poolConfig'
import { CliContext } from '@/index'
import consola from 'consola'
import { confirmOrExit, showWarning, swapCallbackMessage, swapProcessingMessage } from '../../utils/messageUtils'
import { Result, Ok, Err } from '../../types/share'
import { loadKeypair } from '../../utils/utils'
import { getPriorityFeeInfo, PriorityLevel } from '../../utils/transactionUtils'
import { calculatePriceImpact, getPricePredict } from '../readOps/swapInfo'
import { Keypair, Transaction, TransactionInstruction, TransactionInstructionCtorFields } from "@solana/web3.js";

// import { apiSwapBaseOut } from './helpers'

export enum SwapDirection {
    BUY, // Buy ITA Token  ~ Sell SOL
    SELL // Sell ITA Token ~ Buy SOL
}

export const getSwapITATokenIx = async(    
    cctx: CliContext,
    raydium: Raydium,
    poolId: string,
    signer: Keypair,
    amountIn: number,
    direction: SwapDirection,
    priorityLevel: number = PriorityLevel.MEDIUM
): Promise<Result<Transaction | TransactionInstruction | TransactionInstructionCtorFields>> => {
    try {
        const inputAmount = new BN(amountIn)
        const inputMint = direction == SwapDirection.BUY ? NATIVE_MINT.toBase58() : cctx.itaTokenMintPDA.toBase58()
      
        let poolInfo: ApiV3PoolInfoStandardItemCpmm
        let poolKeys: CpmmKeys | undefined
        let rpcData: CpmmParsedRpcData
        if (raydium.cluster === 'mainnet') {
            const data = await raydium.api.fetchPoolById({ ids: poolId })
            poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm
            if (!isValidCpmm(poolInfo.programId)) return Err('target pool is not CPMM pool')
            rpcData = await raydium.cpmm.getRpcPoolInfo(poolInfo.id, true)
        } else {
            const data = await raydium.cpmm.getPoolInfoFromRpc(poolId)
            poolInfo = data.poolInfo
            poolKeys = data.poolKeys
            rpcData = data.rpcData
        }
      
        if (inputMint !== poolInfo.mintA.address && inputMint !== poolInfo.mintB.address) return Err('input mint does not match pool')
        const baseIn = direction == SwapDirection.BUY && NATIVE_MINT.toBase58() === poolInfo.mintA.address // base is typically refers to SOL

        const swapResult = CurveCalculator.swapBaseInput(
            inputAmount,
            baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
            baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
            rpcData.configInfo!.tradeFeeRate,
            rpcData.configInfo!.creatorFeeRate,
            rpcData.configInfo!.protocolFeeRate,
            rpcData.configInfo!.fundFeeRate,
            rpcData.feeOn === FeeOn.BothToken || rpcData.feeOn === FeeOn.OnlyTokenB
        )
      
        const estimate = await getPriorityFeeInfo(cctx.heliusSDK, cctx.configs.ita_token_mint_pda, priorityLevel)
        if (!estimate.ok) return Err(`There is an error in fetching priority estimation fee\n${estimate.error}`)
      
        const payer = signer.publicKey
        const { transaction } = await raydium.cpmm.swap({
          poolInfo,
          poolKeys,
          payer,
          inputAmount,
          swapResult,
          slippage: 0.001, // range: 1 ~ 0.0001, means 100% ~ 0.01%
          baseIn,
        
          txVersion: TxVersion.LEGACY,
          computeBudgetConfig: {
            units: 200_000,
            microLamports: estimate.value,
          },
        })
        return Ok(transaction)
    
    } catch (err) {
        return Err(err as any)
    }
}

// NOTE : mintA is typically refers to native mint aka. SOL
// TODO : payerKpLoc should be replaced with signer:Keypair
export const swapITAToken = async (
    cctx: CliContext,
    raydium: Raydium,
    poolId: string,
    payerKpLoc: string,
    amountIn: number,
    direction: SwapDirection,
    askBeforeAction: boolean,
    priorityLevel: number = PriorityLevel.MEDIUM
): Promise<Result<string>> => {
    if (amountIn < 100_000) showWarning("You are probably using 'amountIn' without considering the token decimals; this may cause the swap to fail.")
    try {
        const [inputSymbol, outputSymbol] = direction == SwapDirection.BUY ? ["SOL", "ITA"] : ["ITA", "SOL"];
        const inputAmount = new BN(amountIn)
        const inputMint = direction == SwapDirection.BUY ? NATIVE_MINT.toBase58() : cctx.itaTokenMintPDA.toBase58()

        let poolInfo: ApiV3PoolInfoStandardItemCpmm
        let poolKeys: CpmmKeys | undefined
        let rpcData: CpmmParsedRpcData
        if (raydium.cluster === 'mainnet') {
            const data = await raydium.api.fetchPoolById({ ids: poolId })
            poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm
            if (!isValidCpmm(poolInfo.programId)) return Err('target pool is not CPMM pool')
            rpcData = await raydium.cpmm.getRpcPoolInfo(poolInfo.id, true)
        } else {
            const data = await raydium.cpmm.getPoolInfoFromRpc(poolId)
            poolInfo = data.poolInfo
            poolKeys = data.poolKeys
            rpcData = data.rpcData
        }
      
        if (inputMint !== poolInfo.mintA.address && inputMint !== poolInfo.mintB.address) return Err('input mint does not match pool')
        const baseIn = direction == SwapDirection.BUY && NATIVE_MINT.toBase58() === poolInfo.mintA.address // base is typically refers to SOL
        const [inputDecimal, outputDecimal] = direction == SwapDirection.BUY ? [poolInfo.mintA.decimals, poolInfo.mintB.decimals] : [poolInfo.mintB.decimals, poolInfo.mintA.decimals]
        const [reserveInput, reserveOutput] = direction == SwapDirection.BUY
          ? [poolInfo.mintAmountA, poolInfo.mintAmountB]
          : [poolInfo.mintAmountB, poolInfo.mintAmountA]

        const swapResult = CurveCalculator.swapBaseInput(
            inputAmount,
            baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
            baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
            rpcData.configInfo!.tradeFeeRate,
            rpcData.configInfo!.creatorFeeRate,
            rpcData.configInfo!.protocolFeeRate,
            rpcData.configInfo!.fundFeeRate,
            rpcData.feeOn === FeeOn.BothToken || rpcData.feeOn === FeeOn.OnlyTokenB
        )
      
        const swapResultAmountIn = swapResult.inputAmount.toNumber()
        const swapResultAmountOut = swapResult.outputAmount.toNumber()
        const tradeFee = swapResult.tradeFee.toNumber()
      
        const estimate = await getPriorityFeeInfo(cctx.heliusSDK, cctx.configs.ita_token_mint_pda, priorityLevel)
        if (!estimate.ok) return Err(`There is an error in fetching priority estimation fee\n${estimate.error}`)
        if (askBeforeAction) {
            const pricePredict = await getPricePredict(cctx, swapResultAmountIn, direction, baseIn)
            const priceImpact = calculatePriceImpact(reserveInput, reserveOutput, swapResultAmountIn, poolInfo.feeRate)
            consola.info("Swap preview based on your input:");
            consola.log(`- You send (input amount): ${swapResultAmountIn} ~ ${swapResultAmountIn / (10 ** inputDecimal)} ${inputSymbol}`);
            consola.log(`- You receive (output amount): ${swapResultAmountOut} ~ ${swapResultAmountOut / (10 ** outputDecimal)} ${outputSymbol}`);
            consola.log(`- Estimated trade fee: ${tradeFee.toString()} ~ ${tradeFee / (10 ** inputDecimal)} SOL`);
            consola.log(`- Priority fee is on ${PriorityLevel[priorityLevel]} level with amount of ${estimate.value} per compute unit\n`)
            if (pricePredict.ok) {
                consola.log(`- Predicted price after swap: ITA worth ${pricePredict.value.newPrice} per 1SOL`);
                consola.log(`- Estimated price impact: ${pricePredict.value.priceImpact.toFixed(2)}%`);
            } else {
                consola.warn(`- Unable to predict price after swap: ${pricePredict.error}`);
                consola.log(`- Estimated price impact (fallback calculation): ${priceImpact.toFixed(2)}%`);
            }
            await confirmOrExit(
              "Do you want to proceed with the swap using the above data?",
              "Swap operation has been terminated by the user."
            )
        }
      
        const payer = payerKpLoc == "admin" ? cctx.configs.admin_wallet_keypair!.publicKey : loadKeypair(payerKpLoc).publicKey
        const { execute, /*transaction*/ } = await raydium.cpmm.swap({
          poolInfo,
          poolKeys,
          payer,
          inputAmount,
          swapResult,
          slippage: 0.001, // range: 1 ~ 0.0001, means 100% ~ 0.01%
          baseIn,
        
          txVersion: TxVersion.V0,
          // optional: set up priority fee here
          computeBudgetConfig: {
            units: 200_000,
            microLamports: estimate.value,
          },
        })

        // const res = await cctx.connection.simulateTransaction(transaction)
        // await confirmOrExit(`continue? ${getUnitConsumed(res.value.unitsConsumed!)}`, "terminated")
        const { txId } = await execute({ sendAndConfirm: true })
        return Ok(txId)
      
    } catch (err) {
        return Err(err as any)
    }
}

export const swapITATokenHandler = async(cctx: CliContext, options: any) => {
    const raydium = await initSdk(cctx)
    try {
      const direction = options.base ? SwapDirection.BUY : SwapDirection.SELL
      const inputPDA = direction == SwapDirection.BUY ? NATIVE_MINT.toBase58() : cctx.configs.ita_token_mint_pda
      swapProcessingMessage(inputPDA, options.amount)
      const result = await swapITAToken(
        cctx, 
        raydium, 
        cctx.configs.raydium_pool_id, 
        options.payer, 
        options.amount, 
        direction, 
        true, 
        options.priorityLevel
      )
      !result.ok ? swapCallbackMessage(true, "", `reason: ${result.error}`) : swapCallbackMessage(false, result.value)

    } catch (error) {
      console.log(error)
    }
}