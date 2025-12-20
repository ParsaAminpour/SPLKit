import { PublicKey, Transaction, VersionedTransaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, NATIVE_MINT } from '@solana/spl-token'
import axios from 'axios'
import { fetchTokenAccountData } from "../../configs/poolConfig"
import { API_URLS, DEV_API_URLS } from '@raydium-io/raydium-sdk-v2'
import { CliContext } from '@/index'
import { AMM_V4, CLMM_PROGRAM_ID, CREATE_CPMM_POOL_PROGRAM } from "@raydium-io/raydium-sdk-v2";


interface SwapCompute {
  id: string
  success: true
  version: 'V0' | 'V1'
  openTime?: undefined
  msg: undefined
  data: {
    swapType: 'BaseIn' | 'BaseOut'
    inputMint: string
    inputAmount: string
    outputMint: string
    outputAmount: string
    otherAmountThreshold: string
    slippageBps: number
    priceImpactPct: number
    routePlan: {
      poolId: string
      inputMint: string
      outputMint: string
      feeMint: string
      feeRate: number
      feeAmount: string
    }[]
  }
}

// swapBaseOut means want to buy 'exact amount' token and calculates how much should spend for input token
// in this example, means want to buy 0.01 RAY and api (swapResponse) will show how many SOL will cost
// NOTE : in swapBaseOut, swapResponse.inputAmount means how much expected to cost and swapResponse.otherAmountThreshold means 'maximum' will cost in this swap
// NOTE : slippage should be in just regular number format, for example slippage:0.5 for 0.5% 
export const apiSwapBaseOut = async (cctx: CliContext, _inputMint: PublicKey, _outputMint: PublicKey, amount: number, slippage: number = 0.5) => {
    const inputMint = _inputMint.toBase58()
    const outputMint = _outputMint.toBase58()
    const txVersion: string = 'V0' // or LEGACY
    const isV0Tx = txVersion === 'V0'
    const owner = cctx.configs.admin_wallet_keypair!
    const _API_URL = cctx.configs.cluster == 'devnet' ? DEV_API_URLS : API_URLS

    const [isInputSol, isOutputSol] = [inputMint === NATIVE_MINT.toBase58(), outputMint === NATIVE_MINT.toBase58()]

    const { tokenAccounts } = await fetchTokenAccountData(cctx.connection, owner)

    const inputTokenAcc = tokenAccounts.find((a: any) => a.mint.toBase58() === inputMint)?.publicKey
    const outputTokenAcc = tokenAccounts.find((a: any) => a.mint.toBase58() === outputMint)?.publicKey

    if (!inputTokenAcc && !isInputSol) {
      console.error('do not have input token account')
      return
    }

    // get statistical transaction fee from api
    /**
     * vh: very high
     * h: high
     * m: medium
     */
    const { data } = await axios.get<{
      id: string
      success: boolean
      data: { default: { vh: number; h: number; m: number } }
    }>(`${_API_URL.BASE_HOST}${_API_URL.PRIORITY_FEE}`)

    const { data: swapResponse } = await axios.get<SwapCompute>(
      `${
        _API_URL.SWAP_HOST
      }/compute/swap-base-out?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${
        slippage! * 100
      }&txVersion=${txVersion}`
    )
    console.log("swap response: ", swapResponse)

    const { data: swapTransactions } = await axios.post<{
      id: string
      version: string
      success: boolean
      data: { transaction: string }[]
    }>(`${_API_URL.SWAP_HOST}/transaction/swap-base-out`, {
      computeUnitPriceMicroLamports: String(data.data.default.h),
      swapResponse,
      txVersion,    wallet: owner.publicKey.toBase58(),
      wrapSol: isInputSol,
      unwrapSol: isOutputSol, // true means output mint receive sol, false means output mint received wsol
      inputAccount: isInputSol ? undefined : inputTokenAcc?.toBase58(),
      outputAccount: isOutputSol ? undefined : outputTokenAcc?.toBase58(),
    })

    const allTxBuf = swapTransactions.data.map((tx) => Buffer.from(tx.transaction, 'base64'))
    const allTransactions = allTxBuf.map((txBuf) =>
      isV0Tx ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf)
    )
    console.log(`total ${allTransactions.length} transactions`, swapTransactions)

    let idx = 0
    if (!isV0Tx) {
      for (const tx of allTransactions) {
        console.log(`${++idx} transaction sending...`)
        const transaction = tx as Transaction
        transaction.sign(owner)
        const txId = await sendAndConfirmTransaction(cctx.connection, transaction, [owner], { skipPreflight: true })
        console.log(`${++idx} transaction confirmed, txId: ${txId}`)
      }
    } else {
      for (const tx of allTransactions) {
        idx++
        const transaction = tx as VersionedTransaction
        transaction.sign([owner])
        const txId = await cctx.connection.sendTransaction(tx as VersionedTransaction, { skipPreflight: true })
        const { lastValidBlockHeight, blockhash } = await cctx.connection.getLatestBlockhash({
          commitment: 'finalized',
        })
        console.log(`${idx} transaction sending..., txId: ${txId}`)
        await cctx.connection.confirmTransaction(
          {
            blockhash,
            lastValidBlockHeight,
            signature: txId,
          },
          'confirmed'
        )
        console.log(`${idx} transaction confirmed`)
      }
    }
}

function checkProgramId(id: PublicKey) {
  if (id.equals(AMM_V4)) return 'ammV4'
  if (id.equals(CLMM_PROGRAM_ID)) return 'clmm'
  if (id.equals(CREATE_CPMM_POOL_PROGRAM)) return 'cpmm'
  return undefined
}

export async function formatSwapInfo(cctx: CliContext, txid: string) {
  const txinfo = await cctx.connection.getParsedTransaction(txid, { maxSupportedTransactionVersion: 0 })
  if (txinfo === null) throw Error('fetch tx info error')
  if (txinfo.meta?.err) throw Error('tx error')

  for (let indexIns = 0; indexIns < txinfo.transaction.message.instructions.length; indexIns++) {
    const itemIns = txinfo.transaction.message.instructions[indexIns]

    const innerIns = ((txinfo.meta?.innerInstructions ?? []).find(i => i.index === indexIns)?.instructions ?? []) as any[]

    const type = checkProgramId(itemIns.programId)

    if (type && innerIns.length >= 2 && innerIns[0].programId.equals(TOKEN_PROGRAM_ID) && innerIns[1].programId.equals(TOKEN_PROGRAM_ID)) {
      const transfer1 = innerIns[0]
      const transfer2 = innerIns[1]
      const transferSource1 = transfer1.parsed.info.source

      const transferAmount1 = transfer1.parsed.info.amount ?? transfer1.parsed.info.tokenAmount.amount
      const transferAmount2 = transfer2.parsed.info.amount ?? transfer2.parsed.info.tokenAmount.amount

      if (type === 'ammV4') {
        // @ts-ignore
        const swapType = itemIns.accounts[4].toString() === transferSource1 ? 'A to B' : 'B to A'

        console.log({
          type,
          // @ts-ignore
          poolId: itemIns.accounts[1].toString(),

          inputAmount: swapType === 'A to B' ? transferAmount1 : transferAmount2,
          outputAmount: swapType === 'A to B' ? transferAmount1 : transferAmount2,
        })
      } else {
        console.log({
          type,
          // @ts-ignore
          poolId: itemIns.accounts[type === 'clmm' ? 2 : 3].toString(),

          inputAmount: transferAmount1,
          outputAmount: transferAmount2,
        })
      }
    }

    for (let innerIndexIns = 0; innerIndexIns < innerIns.length; innerIndexIns++) {
      const innerItemIns = innerIns[innerIndexIns]

      const lastInnerItemIns = innerIns.slice(innerIndexIns + 1)

      const innerType = checkProgramId(innerItemIns.programId)

      if (innerType && lastInnerItemIns.length >= 2 && lastInnerItemIns[0].programId.equals(TOKEN_PROGRAM_ID) && lastInnerItemIns[1].programId.equals(TOKEN_PROGRAM_ID)) {
        const transfer1 = lastInnerItemIns[0]
        const transfer2 = lastInnerItemIns[1]
        const transferSource1 = transfer1.parsed.info.source

        const transferAmount1 = transfer1.parsed.info.amount ?? transfer1.parsed.info.tokenAmount.amount
        const transferAmount2 = transfer2.parsed.info.amount ?? transfer2.parsed.info.tokenAmount.amount

        if (innerType === 'ammV4') {
          // @ts-ignore
          const swapType = innerItemIns.accounts[4].toString() === transferSource1 ? 'A to B' : 'B to A'

          console.log({
            type: innerType,
            // @ts-ignore
            poolId: innerItemIns.accounts[1].toString(),

            inputAmount: swapType === 'A to B' ? transferAmount1 : transferAmount2,
            outputAmount: swapType === 'A to B' ? transferAmount1 : transferAmount2,
          })
        } else {
          console.log({
            type: innerType,
            // @ts-ignore
            poolId: innerItemIns.accounts[innerType === 'clmm' ? 2 : 3].toString(),

            inputAmount: transferAmount1,
            outputAmount: transferAmount2,
          })
        }
      }
    }
  }
}