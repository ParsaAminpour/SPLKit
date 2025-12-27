import { CliContext } from "../src/index";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { ITAConfiguration } from "../src/configs/configs";
import { HeliusClient } from "helius-sdk";
import * as anchor from "@coral-xyz/anchor";
import * as constant from "../src/commands/constants";

/**
 * Creates a mock CliContext for unit testing
 * This initializes all the necessary components similar to the actual setup in src/index.ts
 */
export const createMockCliContext = (overrides?: Partial<CliContext>): CliContext => {
    const adminKeypair = Keypair.generate();
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const adminWallet = new Wallet(adminKeypair);
    
    const provider = new AnchorProvider(
        connection,
        adminWallet,
        { commitment: "confirmed" }
    );

    const mockRpc = () => Promise.resolve("mockMintTxSignature");
    const mockMintToken = () => ({ rpc: mockRpc });
    const mockProgram = {
        methods: {
            mintToken: mockMintToken
        },
        programId: new PublicKey("11111111111111111111111111111111") // Mock program ID
    } as unknown as Program<anchor.Idl>;
    
    const [itaTokenMintPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from(constant.ITA_TOKEN_SEED)],
        mockProgram.programId
    );
    
    const mockConfigs: ITAConfiguration = {
        cluster: "devnet",
        ita_token_program_id: mockProgram.programId.toBase58(),
        ita_token_mint_pda: itaTokenMintPDA.toBase58(),
        raydium_pool_id: "mockPoolId",
        admin_wallet_keypair: adminKeypair,
        cluster_url: "https://api.devnet.solana.com",
        helius_api_key: "mock-helius-api-key",
        ...overrides?.configs
    };
    
    const mockHeliusSDK = {
        getPriorityFeeEstimate: () => Promise.resolve({
            priorityFeeLevels: {
                low: 1000,
                medium: 5000,
                high: 10000,
                veryHigh: 20000,
                unsafeMax: 50000
            }
        })
    } as unknown as HeliusClient;
    
    const cctx: CliContext = {
        program: overrides?.program || mockProgram,
        connection: overrides?.connection || connection,
        provider: overrides?.provider || provider,
        itaTokenMintPDA: overrides?.itaTokenMintPDA || itaTokenMintPDA,
        heliusSDK: overrides?.heliusSDK || mockHeliusSDK,
        configs: mockConfigs,
        ...overrides
    };
    
    return cctx;
};

export const createMockCliContextWithoutAdmin = (): CliContext => {
    const cctx = createMockCliContext();
    cctx.configs.admin_wallet_keypair = undefined;
    return cctx;
};

export const createRecipientKeypair = (): Keypair => {
    return Keypair.generate();
};

