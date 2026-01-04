import { Raydium, TxVersion, DEV_API_URLS, Cluster, parseTokenAccountResp } from '@raydium-io/raydium-sdk-v2'
import { clusterApiUrl, Connection } from '@solana/web3.js'
import { CliContext } from '@/index'
import { Keypair } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'

export const txVersion = TxVersion.V0 // or TxVersion.LEGACY

let raydium: Raydium | undefined
export const initSdk = async (cctx: CliContext, params?: { loadToken?: boolean }, ownerKp?: Keypair) => {
    const connection = cctx.connection 
    if (cctx.connection.rpcEndpoint === clusterApiUrl('mainnet-beta'))
    console.log(`connect to rpc ${connection.rpcEndpoint} in ${cctx.configs.cluster}`)
    
    const owner = ownerKp ? ownerKp : cctx.configs.admin_wallet_keypair
    const cluster = cctx.configs.cluster as Cluster

    raydium = await Raydium.load({
      owner,
      connection,
      cluster,
      disableFeatureCheck: true,
      disableLoadToken: !params?.loadToken,
      blockhashCommitment: 'finalized',
      ...(cluster === 'devnet'
        ? {
            urlConfigs: {
              ...DEV_API_URLS,
              BASE_HOST: 'https://api-v3-devnet.raydium.io',
              OWNER_BASE_HOST: 'https://owner-v1-devnet.raydium.io',
              SWAP_HOST: 'https://transaction-v1-devnet.raydium.io',
              CPMM_LOCK: 'https://dynamic-ipfs-devnet.raydium.io/lock/cpmm/position',
            },
          }
        : {}),
    })

  return raydium
}

export const fetchTokenAccountData = async (connection: Connection, owner: Keypair) => {
  const solAccountResp = await connection.getAccountInfo(owner.publicKey)
  const tokenAccountResp = await connection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_PROGRAM_ID })
  const token2022Req = await connection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_2022_PROGRAM_ID })
  const tokenAccountData = parseTokenAccountResp({
    owner: owner.publicKey,
    solAccountResp,
    tokenAccountResp: {
      context: tokenAccountResp.context,
      value: [...tokenAccountResp.value, ...token2022Req.value],
    },
  })
  return tokenAccountData
}
