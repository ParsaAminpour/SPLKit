import {
    CREATE_CPMM_POOL_PROGRAM,
    CREATE_CPMM_POOL_FEE_ACC,
    DEVNET_PROGRAM_ID,
    getCpmmPdaAmmConfigId,
  } from '@raydium-io/raydium-sdk-v2'
  import BN from 'bn.js'
  import { initSdk, txVersion } from "../../configs/poolConfig"
import { CliContext } from '@/index'
import { NATIVE_MINT } from '@solana/spl-token'
import { PublicKey } from '@metaplex-foundation/js'
import { explorerLink } from '../../utils/messageUtils'
import { Raydium } from '@raydium-io/raydium-sdk-v2'

export const createPool = async (cctx: CliContext, raydium: Raydium, mintAAmount: number, mintBAmount: number) => {  
    const mintA = await raydium.token.getTokenInfo(NATIVE_MINT.toBase58())
    const mintB = await raydium.token.getTokenInfo(cctx.itaTokenMintPDA.toBase58())
    const feeConfigs = await raydium.api.getCpmmConfigs()

    if (raydium.cluster === 'devnet') {
      feeConfigs.forEach((config) => {
        config.id = getCpmmPdaAmmConfigId(cctx.configs.cluster == "devnet" ? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM : CREATE_CPMM_POOL_PROGRAM, config.index).publicKey.toBase58()
      })
    }
  
    const { execute, /*extInfo transaction*/ } = await raydium.cpmm.createPool({
      poolId: new PublicKey(cctx.configs.raydium_pool_id),
      programId: cctx.configs.cluster == "devnet" ? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM : CREATE_CPMM_POOL_PROGRAM,
      poolFeeAccount: cctx.configs.cluster == "devnet" ? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC : CREATE_CPMM_POOL_FEE_ACC,
      mintA,
      mintB,
      mintAAmount: new BN(mintAAmount),
      mintBAmount: new BN(mintBAmount),
      startTime: new BN(0),
      feeConfig: feeConfigs[0],
      associatedOnly: false,
      ownerInfo: {
        useSOLBalance: true,
      },
      txVersion,
      // optional: set up priority fee here
      // computeBudgetConfig: {
      //   units: 600000,
      //   microLamports: 46591500,
      // },
    })
  
    const { txId } = await execute({ sendAndConfirm: true })
    explorerLink(txId, cctx.configs.cluster)

    // console.log('pool created', {
    //   txId,
    //   poolKeys: Object.keys(extInfo.address).reduce(
    //     (acc, cur) => ({
    //       ...acc,
    //       [cur]: extInfo.address[cur as keyof typeof extInfo.address].toString(),
    //     }),
    //     {}
    //   ),
    // })
}

export const createPoolHandle = async(cctx: CliContext, options: any) => {
    const raydium = await initSdk(cctx, { loadToken: true })
    await createPool(cctx, raydium, options.amountA, options.amountB)
}