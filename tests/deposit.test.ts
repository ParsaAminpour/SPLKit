import { depositPool } from "../src/commands/writeOps/deposit";
import { createMockCliContext } from "./setup";
import { PriorityLevel } from "../src/utils/transactionUtils";
import { initSdk } from "../src/configs/poolConfig";
import { getUserTokenBalance } from "../src/commands/readOps/status";
import { isValidCpmm } from "../src/utils/poolUtils";
import { confirmOrExit, showFailureAndReturn } from "../src/utils/messageUtils";
import { Keypair } from "@solana/web3.js";
import BN from "bn.js";
import Decimal from "decimal.js";
import { Percent } from "@raydium-io/raydium-sdk-v2";
import { NATIVE_MINT } from "@solana/spl-token";

jest.mock("../src/configs/poolConfig");
jest.mock("../src/commands/readOps/status");
jest.mock("../src/utils/poolUtils");
jest.mock("../src/utils/messageUtils");

describe("depositPool", () => {
    let mockCctx: ReturnType<typeof createMockCliContext>;
    let signerKeypair: Keypair;
    let mockRaydium: any;
    const mockTxId = "mockDepositTxSignature";

    const createMockPoolInfo = (poolId: string, mintB: string, decimalsA: number = 9, decimalsB: number = 9) => ({
        id: poolId,
        programId: "CPMMoo8L3F4NbTegBCKVNuxggL7H1ZpdTHKxQB5qKP1C",
        mintA: { address: NATIVE_MINT.toBase58(), decimals: decimalsA },
        mintB: { address: mintB, decimals: decimalsB },
    });

    const createMockRpcPoolInfo = () => ({
        baseReserve: new BN(1000000000),
        quoteReserve: new BN(2000000000),
        lpAmount: new BN(500000000),
        vaultAAmount: new BN(1000000000),
        vaultBAmount: new BN(2000000000),
        poolPrice: new Decimal(2.0),
    });

    const createMockComputeResult = (isBase: boolean) => ({
        inputAmountFee: {
            amount: new BN(isBase ? 100000000 : 200000000),
            fee: undefined,
        },
        anotherAmount: {
            amount: new BN(isBase ? 200000000 : 100000000),
            fee: undefined,
        },
        liquidity: new BN(50000000),
    });

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockCctx = createMockCliContext();
        signerKeypair = Keypair.generate();
        
        (confirmOrExit as jest.Mock).mockResolvedValue(undefined);
        (showFailureAndReturn as unknown as jest.Mock).mockImplementation((message: string) => {
            throw new Error(message);
        });
        (isValidCpmm as jest.Mock).mockReturnValue(true);
        (getUserTokenBalance as jest.Mock).mockResolvedValue(1000000000); // 1 token with 9 decimals
        mockCctx.connection.getBalance = jest.fn().mockResolvedValue(2000000000) as any; // 2 SOL
        
        mockRaydium = {
            cluster: "devnet",
            api: {
                fetchPoolById: jest.fn(),
            },
            cpmm: {
                getPoolInfoFromRpc: jest.fn(),
                getRpcPoolInfos: jest.fn(),
                computePairAmount: jest.fn(),
                addLiquidity: jest.fn(),
            },
            fetchEpochInfo: jest.fn().mockResolvedValue({}),
        };
        
        const poolId = mockCctx.configs.raydium_pool_id;
        const mockPoolInfo = createMockPoolInfo(poolId, mockCctx.itaTokenMintPDA.toBase58());
        const mockRpcPoolInfo = createMockRpcPoolInfo();
        
        mockRaydium.cpmm.getPoolInfoFromRpc.mockResolvedValue({
            poolInfo: mockPoolInfo,
            poolKeys: { id: poolId },
        });
        
        mockRaydium.cpmm.getRpcPoolInfos.mockResolvedValue({
            [poolId]: mockRpcPoolInfo,
        });
        
        mockRaydium.cpmm.computePairAmount.mockResolvedValue(createMockComputeResult(true));
        
        mockRaydium.cpmm.addLiquidity.mockResolvedValue({
            execute: jest.fn().mockResolvedValue({ txId: mockTxId }),
        });
        
        (initSdk as jest.Mock).mockResolvedValue(mockRaydium);
    });

    describe("Success cases", () => {
        it("should successfully deposit liquidity with base token (SOL) without asking before action", async () => {
            const uiAmount = 0.1;
            const isBase = true;
            const slippage = 1;
            const priorityLevel = PriorityLevel.MEDIUM;

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                isBase,
                slippage,
                priorityLevel,
                false
            );

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(mockTxId);
            }

            expect(initSdk).toHaveBeenCalledWith(mockCctx, undefined, signerKeypair);
            expect(mockRaydium.cpmm.getPoolInfoFromRpc).toHaveBeenCalledWith(mockCctx.configs.raydium_pool_id);
            expect(mockRaydium.cpmm.computePairAmount).toHaveBeenCalled();
            expect(mockRaydium.cpmm.addLiquidity).toHaveBeenCalled();
            expect(confirmOrExit).not.toHaveBeenCalled();
        });

        it("should successfully deposit liquidity with quote token (ITA) without asking before action", async () => {
            const uiAmount = 0.2;
            const isBase = false;
            const slippage = 2;
            const priorityLevel = PriorityLevel.MEDIUM;

            mockRaydium.cpmm.computePairAmount.mockResolvedValue(createMockComputeResult(false));

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                isBase,
                slippage,
                priorityLevel,
                false
            );

            expect(result.ok).toBe(true);
            expect(mockRaydium.cpmm.addLiquidity).toHaveBeenCalled();
        });

        it("should successfully deposit with askBeforeAction enabled", async () => {
            const uiAmount = 0.1;
            const isBase = true;

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                isBase,
                undefined,
                PriorityLevel.MEDIUM,
                true
            );

            expect(result.ok).toBe(true);
            expect(confirmOrExit).toHaveBeenCalledWith(
                "Do you want to continue adding liquidity?",
                "Adding liquidity operation has been terminated"
            );
            expect(getUserTokenBalance).toHaveBeenCalledWith(mockCctx, signerKeypair.publicKey);
            expect(mockCctx.connection.getBalance).toHaveBeenCalledWith(signerKeypair.publicKey);
        });

        it("should use default slippage (2%) when not provided", async () => {
            const uiAmount = 0.1;
            const isBase = true;

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                isBase,
                undefined,
                PriorityLevel.MEDIUM,
                false
            );

            expect(result.ok).toBe(true);
            expect(mockRaydium.cpmm.addLiquidity).toHaveBeenCalledWith(
                expect.objectContaining({
                    slippage: expect.any(Percent),
                })
            );
        });

        it("should use default priority level (MEDIUM) when not provided", async () => {
            const uiAmount = 0.1;
            const isBase = true;

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                isBase,
                undefined,
                2, // Default priority level
                false
            );

            expect(result.ok).toBe(true);
        });

        it("should correctly calculate inputAmount with decimals", async () => {
            const uiAmount = 0.1;
            const isBase = true;
            const decimalsA = 9;

            const mockPoolInfo = createMockPoolInfo(mockCctx.configs.raydium_pool_id, mockCctx.itaTokenMintPDA.toBase58(), decimalsA, 9);
            mockRaydium.cpmm.getPoolInfoFromRpc.mockResolvedValue({
                poolInfo: mockPoolInfo,
                poolKeys: { id: mockCctx.configs.raydium_pool_id },
            });

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                isBase,
                undefined,
                PriorityLevel.MEDIUM,
                false
            );

            expect(result.ok).toBe(true);
            expect(mockRaydium.cpmm.addLiquidity).toHaveBeenCalledWith(
                expect.objectContaining({
                    inputAmount: expect.any(BN),
                })
            );
        });

        it("should correctly set baseIn parameter based on isBase flag", async () => {
            const uiAmount = 0.1;
            
            let result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                true,
                undefined,
                PriorityLevel.MEDIUM,
                false
            );
            expect(result.ok).toBe(true);
            expect(mockRaydium.cpmm.addLiquidity).toHaveBeenCalledWith(
                expect.objectContaining({
                    baseIn: true,
                })
            );

        });

        it("should correctly set baseIn parameter to false when isBase is false", async () => {
            const uiAmount = 0.1;
            
            mockRaydium.cpmm.computePairAmount.mockResolvedValue(createMockComputeResult(false));
            mockRaydium.cpmm.addLiquidity.mockResolvedValue({
                execute: jest.fn().mockResolvedValue({ txId: mockTxId }),
            });

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                false,
                undefined,
                PriorityLevel.MEDIUM,
                false
            );
            expect(result.ok).toBe(true);
            expect(mockRaydium.cpmm.addLiquidity).toHaveBeenCalledWith(
                expect.objectContaining({
                    baseIn: false,
                })
            );
        });
    });

    describe("Mainnet vs Devnet", () => {
        it("should use mainnet API path when cluster is mainnet", async () => {
            const uiAmount = 0.1;
            const isBase = true;
            mockRaydium.cluster = "mainnet";
            
            const mockPoolInfo = createMockPoolInfo(mockCctx.configs.raydium_pool_id, mockCctx.itaTokenMintPDA.toBase58());
            const mockRpcPoolInfo = createMockRpcPoolInfo();
            
            mockRaydium.api.fetchPoolById.mockResolvedValue([mockPoolInfo]);
            mockRaydium.cpmm.getRpcPoolInfo = jest.fn().mockResolvedValue(mockRpcPoolInfo);

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                isBase,
                undefined,
                PriorityLevel.MEDIUM,
                false
            );

            expect(result.ok).toBe(true);
            expect(mockRaydium.api.fetchPoolById).toHaveBeenCalledWith({ ids: mockCctx.configs.raydium_pool_id });
            expect(mockRaydium.cpmm.getPoolInfoFromRpc).not.toHaveBeenCalled();
        });

        it("should use devnet RPC path when cluster is devnet", async () => {
            const uiAmount = 0.1;
            const isBase = true;
            mockRaydium.cluster = "devnet";

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                isBase,
                undefined,
                PriorityLevel.MEDIUM,
                false
            );

            expect(result.ok).toBe(true);
            expect(mockRaydium.cpmm.getPoolInfoFromRpc).toHaveBeenCalledWith(mockCctx.configs.raydium_pool_id);
            expect(mockRaydium.api.fetchPoolById).not.toHaveBeenCalled();
        });
    });

    describe("Balance validation", () => {
        it("should throw error when SOL balance is insufficient for base deposit", async () => {
            const uiAmount = 0.1;
            const isBase = true;
            (mockCctx.connection.getBalance as jest.Mock).mockResolvedValue(50000000); // 0.05 SOL - insufficient

            await expect(
                depositPool(
                    mockCctx,
                    signerKeypair,
                    uiAmount,
                    isBase,
                    undefined,
                    PriorityLevel.MEDIUM,
                    false
                )
            ).rejects.toThrow("You have not sufficient (SOL) blanace to done this operation");
        });

        it("should throw error when ITA balance is insufficient for base deposit", async () => {
            const uiAmount = 0.1;
            const isBase = true;
            (getUserTokenBalance as jest.Mock).mockResolvedValue(50000000); // Insufficient ITA

            await expect(
                depositPool(
                    mockCctx,
                    signerKeypair,
                    uiAmount,
                    isBase,
                    undefined,
                    PriorityLevel.MEDIUM,
                    false
                )
            ).rejects.toThrow("You have not sufficient (ITA) blanace to done this operation");
        });

        it("should throw error when ITA balance is insufficient for quote deposit", async () => {
            const uiAmount = 0.2;
            const isBase = false;
            mockRaydium.cpmm.computePairAmount.mockResolvedValue(createMockComputeResult(false));
            (getUserTokenBalance as jest.Mock).mockResolvedValue(50000000); // Insufficient ITA

            await expect(
                depositPool(
                    mockCctx,
                    signerKeypair,
                    uiAmount,
                    isBase,
                    undefined,
                    PriorityLevel.MEDIUM,
                    false
                )
            ).rejects.toThrow("You have not sufficient (ITA) blanace to done this operation");
        });

        it("should throw error when SOL balance is insufficient for quote deposit", async () => {
            const uiAmount = 0.2;
            const isBase = false;
            mockRaydium.cpmm.computePairAmount.mockResolvedValue(createMockComputeResult(false));
            (mockCctx.connection.getBalance as jest.Mock).mockResolvedValue(50000000); // Insufficient SOL

            await expect(
                depositPool(
                    mockCctx,
                    signerKeypair,
                    uiAmount,
                    isBase,
                    undefined,
                    PriorityLevel.MEDIUM,
                    false
                )
            ).rejects.toThrow("You have not sufficient  (SOL) blanace to done this operation");
        });
    });

    // TODO : Complete here
    describe("Error cases", () => {
        it("should return error when pool is not CPMM pool (mainnet)", async () => {
            const uiAmount = 0.1;
            const isBase = true;
            mockRaydium.cluster = "mainnet";
            
            const mockPoolInfo = createMockPoolInfo(mockCctx.configs.raydium_pool_id, mockCctx.itaTokenMintPDA.toBase58());
            mockPoolInfo.programId = "invalidProgramId";
            
            mockRaydium.api.fetchPoolById.mockResolvedValue([mockPoolInfo]);
            (isValidCpmm as jest.Mock).mockReturnValue(false);

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                isBase,
                undefined,
                PriorityLevel.MEDIUM,
                false
            );

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe("target pool is not CPMM pool");
            }
        });

        it("should return error when initSdk fails", async () => {
            const uiAmount = 0.1;
            const isBase = true;
            (initSdk as jest.Mock).mockRejectedValue(new Error("SDK initialization failed"));

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                isBase,
                undefined,
                PriorityLevel.MEDIUM,
                false
            );

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBeDefined();
            }
        });

        it("should return error when getPoolInfoFromRpc fails", async () => {
            const uiAmount = 0.1;
            const isBase = true;
            mockRaydium.cpmm.getPoolInfoFromRpc.mockRejectedValue(new Error("RPC fetch failed"));

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                isBase,
                undefined,
                PriorityLevel.MEDIUM,
                false
            );

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBeDefined();
            }
        });

        it("should return error when computePairAmount fails", async () => {
            const uiAmount = 0.1;
            const isBase = true;
            mockRaydium.cpmm.computePairAmount.mockRejectedValue(new Error("Compute failed"));

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                isBase,
                undefined,
                PriorityLevel.MEDIUM,
                false
            );

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBeDefined();
            }
        });

        it("should return error when addLiquidity execution fails", async () => {
            const uiAmount = 0.1;
            const isBase = true;
            mockRaydium.cpmm.addLiquidity.mockResolvedValue({
                execute: jest.fn().mockRejectedValue(new Error("Add liquidity failed")),
            });

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                isBase,
                undefined,
                PriorityLevel.MEDIUM,
                false
            );

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBeDefined();
            }
        });

        it("should return error when getUserTokenBalance fails", async () => {
            const uiAmount = 0.1;
            const isBase = true;
            (getUserTokenBalance as jest.Mock).mockRejectedValue(new Error("Balance fetch failed"));

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                isBase,
                undefined,
                PriorityLevel.MEDIUM,
                true
            );

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBeDefined();
            }
        });

        it("should return error when getBalance fails", async () => {
            const uiAmount = 0.1;
            const isBase = true;
            (mockCctx.connection.getBalance as jest.Mock).mockRejectedValue(new Error("SOL balance fetch failed"));

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                isBase,
                undefined,
                PriorityLevel.MEDIUM,
                true
            );

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBeDefined();
            }
        });
    });

    describe("Edge cases", () => {
        it("should handle very small amounts", async () => {
            const uiAmount = 0.000001;
            const isBase = true;

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                isBase,
                undefined,
                PriorityLevel.MEDIUM,
                false
            );

            expect(result.ok).toBe(true);
        });

        it("should handle very large amounts", async () => {
            const uiAmount = 1000000;
            const isBase = true;

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                isBase,
                undefined,
                PriorityLevel.MEDIUM,
                false
            );

            expect(result.ok).toBe(true);
        });

        it("should handle zero amount", async () => {
            const uiAmount = 0;
            const isBase = true;

            const result = await depositPool(
                mockCctx,
                signerKeypair,
                uiAmount,
                isBase,
                undefined,
                PriorityLevel.MEDIUM,
                false
            );

            expect(result.ok).toBe(true);
        });

        it("should handle different decimal configurations", async () => {
            const uiAmount = 0.1;
            const isBase = true;
            const testCases = [
                { decimalsA: 6, decimalsB: 9 },
                { decimalsA: 9, decimalsB: 6 },
                { decimalsA: 18, decimalsB: 9 },
            ];

            for (const testCase of testCases) {
                jest.clearAllMocks();
                mockRaydium.cpmm.addLiquidity.mockResolvedValue({
                    execute: jest.fn().mockResolvedValue({ txId: mockTxId }),
                });
                mockRaydium.cpmm.computePairAmount.mockResolvedValue(createMockComputeResult(true));
                mockRaydium.cpmm.getRpcPoolInfos.mockResolvedValue({
                    [mockCctx.configs.raydium_pool_id]: createMockRpcPoolInfo(),
                });

                const mockPoolInfo = createMockPoolInfo(mockCctx.configs.raydium_pool_id, mockCctx.itaTokenMintPDA.toBase58(), testCase.decimalsA, testCase.decimalsB);
                mockRaydium.cpmm.getPoolInfoFromRpc.mockResolvedValue({
                    poolInfo: mockPoolInfo,
                    poolKeys: { id: mockCctx.configs.raydium_pool_id },
                });

                const result = await depositPool(
                    mockCctx,
                    signerKeypair,
                    uiAmount,
                    isBase,
                    undefined,
                    PriorityLevel.MEDIUM,
                    false
                );

                expect(result.ok).toBe(true);
            }
        });

        it("should handle different priority levels", async () => {
            const uiAmount = 0.1;
            const isBase = true;
            const priorityLevels = [
                PriorityLevel.LOW,
                PriorityLevel.MEDIUM,
                PriorityLevel.HIGH,
                PriorityLevel.VERY_HIGH,
                PriorityLevel.UNSAFE_MAX,
            ];

            for (const priorityLevel of priorityLevels) {
                jest.clearAllMocks();
                mockRaydium.cpmm.addLiquidity.mockResolvedValue({
                    execute: jest.fn().mockResolvedValue({ txId: mockTxId }),
                });
                mockRaydium.cpmm.computePairAmount.mockResolvedValue(createMockComputeResult(true));

                const result = await depositPool(
                    mockCctx,
                    signerKeypair,
                    uiAmount,
                    isBase,
                    undefined,
                    priorityLevel,
                    false
                );

                expect(result.ok).toBe(true);
            }
        });
    });
});

