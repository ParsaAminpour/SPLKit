import { swapITAToken, SwapDirection } from "../src/commands/writeOps/swap";
import { createMockCliContext } from "./setup";
import { Ok, Err } from "../src/types/share";
import { PriorityLevel } from "../src/utils/transactionUtils";
import { getPriorityFeeInfo } from "../src/utils/transactionUtils";
import { loadKeypair } from "../src/utils/utils";
import { isValidCpmm } from "../src/utils/poolUtils";
import { confirmOrExit, showWarning } from "../src/utils/messageUtils";
import { NATIVE_MINT } from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";
import BN from "bn.js";
import {
    CurveCalculator,
    FeeOn,
} from "@raydium-io/raydium-sdk-v2";

jest.mock("../src/utils/transactionUtils");
jest.mock("../src/utils/utils");
jest.mock("../src/utils/poolUtils");
jest.mock("../src/utils/messageUtils");
jest.mock("@raydium-io/raydium-sdk-v2", () => ({
    ...jest.requireActual("@raydium-io/raydium-sdk-v2"),
    CurveCalculator: {
        swapBaseInput: jest.fn(),
    },
}));

describe("swapITAToken", () => {
    let mockCctx: ReturnType<typeof createMockCliContext>;
    let mockRaydium: any;
    let payerKeypair: Keypair;
    const poolId = "testPoolId123";
    const mockTxId = "mockSwapTxSignature";

    const createMockPoolInfo = (mintA: string, mintB: string, decimalsA: number = 9, decimalsB: number = 9) => ({
        id: poolId,
        programId: "CPMMoo8L3F4NbTegBCKVNuxggL7H1ZpdTHKxQB5qKP1C",
        mintA: { address: mintA, decimals: decimalsA },
        mintB: { address: mintB, decimals: decimalsB },
    });

    const createMockRpcData = () => ({
        baseReserve: new BN(1000000000),
        quoteReserve: new BN(2000000000),
        configInfo: {
            tradeFeeRate: new BN(25),
            creatorFeeRate: new BN(0),
            protocolFeeRate: new BN(0),
            fundFeeRate: new BN(0),
        },
        feeOn: FeeOn.BothToken,
    });

    const createMockSwapResult = () => ({
        inputAmount: new BN(100000000),
        outputAmount: new BN(180000000),
        tradeFee: new BN(250000),
    });

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockCctx = createMockCliContext();
        payerKeypair = Keypair.generate();
        
        (getPriorityFeeInfo as jest.Mock).mockResolvedValue(Ok(5000));
        (confirmOrExit as jest.Mock).mockResolvedValue(undefined);
        (showWarning as jest.Mock).mockImplementation(() => {});
        (isValidCpmm as jest.Mock).mockReturnValue(true);
        (loadKeypair as jest.Mock).mockReturnValue(payerKeypair);
        
        const mockSwapResult = createMockSwapResult();
        (CurveCalculator.swapBaseInput as jest.Mock).mockReturnValue(mockSwapResult);
        
        mockRaydium = {
            cluster: "devnet",
            api: {
                fetchPoolById: jest.fn(),
            },
            cpmm: {
                getPoolInfoFromRpc: jest.fn(),
                getRpcPoolInfo: jest.fn(),
                swap: jest.fn(),
            },
        };
        
        const mockPoolInfo = createMockPoolInfo(
            NATIVE_MINT.toBase58(),
            mockCctx.itaTokenMintPDA.toBase58()
        );
        const mockRpcData = createMockRpcData();
        
        mockRaydium.cpmm.getPoolInfoFromRpc.mockResolvedValue({
            poolInfo: mockPoolInfo,
            poolKeys: { id: poolId },
            rpcData: mockRpcData,
        });
        
        mockRaydium.cpmm.swap.mockResolvedValue({
            execute: jest.fn().mockResolvedValue({ txId: mockTxId }),
        });
        
        Object.defineProperty(mockCctx.heliusSDK, 'getPriorityFeeEstimate', {
            value: jest.fn().mockResolvedValue({
                priorityFeeLevels: {
                    low: 1000,
                    medium: 5000,
                    high: 10000,
                    veryHigh: 20000,
                    unsafeMax: 50000
                }
            }),
            writable: true,
            configurable: true
        });
    });

    describe("Success cases", () => {
        it("should successfully swap BUY direction without asking before action", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.BUY;

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                false,
                PriorityLevel.MEDIUM
            );

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(mockTxId);
            }

            expect(mockRaydium.cpmm.getPoolInfoFromRpc).toHaveBeenCalledWith(poolId);
            expect(CurveCalculator.swapBaseInput).toHaveBeenCalled();
            expect(mockRaydium.cpmm.swap).toHaveBeenCalled();
            expect(confirmOrExit).not.toHaveBeenCalled();
        });

        it("should successfully swap SELL direction without asking before action", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.SELL;

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                false,
                PriorityLevel.MEDIUM
            );

            expect(result.ok).toBe(true);
            expect(mockRaydium.cpmm.swap).toHaveBeenCalled();
        });

        it("should successfully swap with askBeforeAction enabled", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.BUY;

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                true,
                PriorityLevel.MEDIUM
            );

            expect(result.ok).toBe(true);
            expect(confirmOrExit).toHaveBeenCalledWith(
                "Do you want to proceed with the swap using the above data?",
                "Swap operation has been terminated by the user."
            );
        });

        it("should use default priority level when not provided", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.BUY;

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                false
            );

            expect(result.ok).toBe(true);
            expect(getPriorityFeeInfo).toHaveBeenCalledWith(
                mockCctx.heliusSDK,
                mockCctx.configs.ita_token_mint_pda,
                PriorityLevel.MEDIUM
            );
        });

        it("should use custom payer keypair when payerKpLoc is not admin", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.BUY;
            const customKeypairPath = "/path/to/keypair.json";

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                customKeypairPath,
                amountIn,
                direction,
                false
            );

            expect(result.ok).toBe(true);
            expect(loadKeypair).toHaveBeenCalledWith(customKeypairPath);
            expect(mockRaydium.cpmm.swap).toHaveBeenCalledWith(
                expect.objectContaining({
                    payer: payerKeypair.publicKey,
                })
            );
        });

        it("should show warning when amountIn is less than 100_000", async () => {
            const amountIn = 50000;
            const direction = SwapDirection.BUY;

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                false
            );

            expect(result.ok).toBe(true);
            expect(showWarning).toHaveBeenCalledWith(
                "You are probably using 'amountIn' without considering the token decimals; this may cause the swap to fail."
            );
        });
    });

    describe("Mainnet vs Devnet", () => {
        it("should use mainnet API path when cluster is mainnet", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.BUY;
            mockRaydium.cluster = "mainnet";
            
            const mockPoolInfo = createMockPoolInfo(
                NATIVE_MINT.toBase58(),
                mockCctx.itaTokenMintPDA.toBase58()
            );
            const mockRpcData = createMockRpcData();
            
            mockRaydium.api.fetchPoolById.mockResolvedValue([mockPoolInfo]);
            mockRaydium.cpmm.getRpcPoolInfo.mockResolvedValue(mockRpcData);

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                false
            );

            expect(result.ok).toBe(true);
            expect(mockRaydium.api.fetchPoolById).toHaveBeenCalledWith({ ids: poolId });
            expect(mockRaydium.cpmm.getRpcPoolInfo).toHaveBeenCalledWith(poolId, true);
            expect(mockRaydium.cpmm.getPoolInfoFromRpc).not.toHaveBeenCalled();
        });

        it("should use devnet RPC path when cluster is devnet", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.BUY;
            mockRaydium.cluster = "devnet";

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                false
            );

            expect(result.ok).toBe(true);
            expect(mockRaydium.cpmm.getPoolInfoFromRpc).toHaveBeenCalledWith(poolId);
            expect(mockRaydium.api.fetchPoolById).not.toHaveBeenCalled();
        });
    });

    describe("Error cases", () => {
        it("should return error when pool is not CPMM pool (mainnet)", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.BUY;
            mockRaydium.cluster = "mainnet";
            
            const mockPoolInfo = createMockPoolInfo(
                NATIVE_MINT.toBase58(),
                mockCctx.itaTokenMintPDA.toBase58()
            );
            mockPoolInfo.programId = "invalidProgramId";
            
            mockRaydium.api.fetchPoolById.mockResolvedValue([mockPoolInfo]);
            (isValidCpmm as jest.Mock).mockReturnValue(false);

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                false
            );

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe("target pool is not CPMM pool");
            }
        });

        it("should return error when input mint does not match pool", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.BUY;
            
            const mockPoolInfo = createMockPoolInfo(
                "differentMintA",
                "differentMintB"
            );
            
            mockRaydium.cpmm.getPoolInfoFromRpc.mockResolvedValue({
                poolInfo: mockPoolInfo,
                poolKeys: { id: poolId },
                rpcData: createMockRpcData(),
            });

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                false
            );

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe("input mint does not match pool");
            }
        });

        it("should return error when priority fee estimation fails", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.BUY;
            (getPriorityFeeInfo as jest.Mock).mockResolvedValue(Err("Priority fee error"));

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                false
            );

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain("There is an error in fetching priority estimation fee");
            }
            expect(mockRaydium.cpmm.swap).not.toHaveBeenCalled();
        });

        it("should return error when mainnet API fetch fails", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.BUY;
            mockRaydium.cluster = "mainnet";
            mockRaydium.api.fetchPoolById.mockRejectedValue(new Error("API fetch failed"));

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                false
            );

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBeDefined();
            }
        });

        it("should return error when devnet RPC fetch fails", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.BUY;
            mockRaydium.cpmm.getPoolInfoFromRpc.mockRejectedValue(new Error("RPC fetch failed"));

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                false
            );

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBeDefined();
            }
        });

        it("should return error when swap execution fails", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.BUY;
            mockRaydium.cpmm.swap.mockResolvedValue({
                execute: jest.fn().mockRejectedValue(new Error("Swap execution failed")),
            });

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                false
            );

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBeDefined();
            }
        });

        it("should return error when loadKeypair fails for custom payer", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.BUY;
            const customKeypairPath = "/path/to/keypair.json";
            (loadKeypair as jest.Mock).mockImplementation(() => {
                throw new Error("Keypair file not found");
            });

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                customKeypairPath,
                amountIn,
                direction,
                false
            );

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBeDefined();
            }
        });
    });

    describe("Swap direction and mint handling", () => {
        it("should correctly identify baseIn for BUY direction when mintA is NATIVE_MINT", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.BUY;
            
            const mockPoolInfo = createMockPoolInfo(
                NATIVE_MINT.toBase58(),
                mockCctx.itaTokenMintPDA.toBase58()
            );
            
            mockRaydium.cpmm.getPoolInfoFromRpc.mockResolvedValue({
                poolInfo: mockPoolInfo,
                poolKeys: { id: poolId },
                rpcData: createMockRpcData(),
            });

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                false
            );

            expect(result.ok).toBe(true);
            expect(CurveCalculator.swapBaseInput).toHaveBeenCalledWith(
                expect.any(BN),
                expect.any(BN),
                expect.any(BN),
                expect.any(BN),
                expect.any(BN),
                expect.any(BN),
                expect.any(BN),
                expect.any(Boolean)
            );
        });

        it("should correctly handle SELL direction with mintB as input", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.SELL;
            
            // @ts-ignore
            const mockPoolInfo = createMockPoolInfo(
                NATIVE_MINT.toBase58(),
                mockCctx.itaTokenMintPDA.toBase58()
            );

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                false
            );

            expect(result.ok).toBe(true);
            expect(mockRaydium.cpmm.swap).toHaveBeenCalled();
        });

        it("should correctly calculate decimals for BUY direction", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.BUY;
            
            const mockPoolInfo = createMockPoolInfo(
                NATIVE_MINT.toBase58(),
                mockCctx.itaTokenMintPDA.toBase58(),
                9,
                6
            );
            
            mockRaydium.cpmm.getPoolInfoFromRpc.mockResolvedValue({
                poolInfo: mockPoolInfo,
                poolKeys: { id: poolId },
                rpcData: createMockRpcData(),
            });

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                true
            );

            expect(result.ok).toBe(true);
        });

        it("should correctly calculate decimals for SELL direction", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.SELL;

            // @ts-ignore
            const mockPoolInfo = createMockPoolInfo(
                NATIVE_MINT.toBase58(),
                mockCctx.itaTokenMintPDA.toBase58(),
                9,
                6
            );

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                true
            );

            expect(result.ok).toBe(true);
        });
    });

    describe("Edge cases", () => {
        it("should handle very large amounts", async () => {
            const amountIn = 1000000000000;
            const direction = SwapDirection.BUY;

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                false
            );

            expect(result.ok).toBe(true);
            expect(CurveCalculator.swapBaseInput).toHaveBeenCalledWith(
                expect.objectContaining({}),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything()
            );
        });

        it("should handle different priority levels", async () => {
            const amountIn = 100000000;
            const direction = SwapDirection.BUY;
            const priorityLevel = PriorityLevel.HIGH;

            const result = await swapITAToken(
                mockCctx,
                mockRaydium,
                poolId,
                "admin",
                amountIn,
                direction,
                false,
                priorityLevel
            );

            expect(result.ok).toBe(true);
            expect(getPriorityFeeInfo).toHaveBeenCalledWith(
                mockCctx.heliusSDK,
                mockCctx.configs.ita_token_mint_pda,
                priorityLevel
            );
        });
    });
});

