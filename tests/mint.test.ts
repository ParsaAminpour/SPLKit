import { mintToken } from "../src/commands/writeOps/mint";
import { createMockCliContext, createMockCliContextWithoutAdmin, createRecipientKeypair } from "./setup";
import { Ok, Err } from "../src/types/share";
import { PriorityLevel } from "../src/utils/transactionUtils";
import * as utils from "../src/utils/utils";
import { singleTransfer } from "../src/utils/transferUtils";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { PublicKey } from "@metaplex-foundation/js";


// Mock dependencies
jest.mock("../src/utils/utils");
jest.mock("../src/utils/transferUtils");
jest.mock("@solana/spl-token", () => ({
    ...jest.requireActual("@solana/spl-token"),
    getOrCreateAssociatedTokenAccount: jest.fn(),
    getAssociatedTokenAddressSync: jest.fn((_mint, _owner) => {
        return new PublicKey("11111111111111111111111111111112");
    })
}));

describe("mintToken", () => {
    let mockCctx: ReturnType<typeof createMockCliContext>;
    let recipientKeypair: ReturnType<typeof createRecipientKeypair>;
    let recipientAddress: string;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockCctx = createMockCliContext();
        recipientKeypair = createRecipientKeypair();
        recipientAddress = recipientKeypair.publicKey.toBase58();
        
        (utils.getNumberOfDecimals as jest.Mock).mockResolvedValue(9);
        (getOrCreateAssociatedTokenAccount as jest.Mock).mockResolvedValue({
            address: new PublicKey("11111111111111111111111111111112")
        });
        (singleTransfer as jest.Mock).mockResolvedValue(Ok("mockTransferTxSignature"));
        
        const mockRpc = jest.fn().mockResolvedValue("mockMintTxSignature");
        const mockMintToken = jest.fn().mockReturnValue({ rpc: mockRpc });
        (mockCctx.program.methods as any).mintToken = mockMintToken;
        
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
        it("should successfully mint tokens to a recipient", async () => {
            const amount = 100;
            const priorityLevel = PriorityLevel.MEDIUM;

            const result = await mintToken(mockCctx, recipientAddress, amount, priorityLevel);

            expect(result.ok).toBe(true);
            if (result.ok) {
                const [mintTx, transferTx] = result.value.split(",");
                expect(mintTx).toBe("mockMintTxSignature");
                expect(transferTx).toBe("mockTransferTxSignature");
            }

            const mintTokenMethod = (mockCctx.program.methods as any).mintToken;
            expect(mintTokenMethod).toHaveBeenCalledWith(
                expect.objectContaining({ toString: expect.any(Function) })
            );
            expect(mintTokenMethod().rpc).toHaveBeenCalled();

            expect(utils.getNumberOfDecimals).toHaveBeenCalledWith(
                mockCctx.connection,
                mockCctx.itaTokenMintPDA
            );

            expect(getOrCreateAssociatedTokenAccount).toHaveBeenCalledWith(
                mockCctx.connection,
                mockCctx.configs.admin_wallet_keypair,
                expect.any(PublicKey),
                expect.any(PublicKey)
            );

            expect(singleTransfer).toHaveBeenCalledWith(
                mockCctx,
                mockCctx.configs.admin_wallet_keypair,
                expect.any(PublicKey),
                expect.any(PublicKey),
                mockCctx.configs.admin_wallet_keypair!.publicKey,
                amount * Math.pow(10, 9) // amount * 10^decimals
            );
        });

        it("should use default priority level (MEDIUM) when not provided", async () => {
            const amount = 50;

            const result = await mintToken(mockCctx, recipientAddress, amount);

            expect(result.ok).toBe(true);
            expect((mockCctx.heliusSDK.getPriorityFeeEstimate as jest.Mock)).toHaveBeenCalled();
        });

        it("should handle different priority levels", async () => {
            const amount = 200;
            const priorityLevel = PriorityLevel.HIGH;

            const result = await mintToken(mockCctx, recipientAddress, amount, priorityLevel);

            expect(result.ok).toBe(true);
            expect((mockCctx.heliusSDK.getPriorityFeeEstimate as jest.Mock)).toHaveBeenCalled();
        });

        it("should correctly calculate amount with decimals", async () => {
            const amount = 100;
            const decimals = 6;
            (utils.getNumberOfDecimals as jest.Mock).mockResolvedValue(decimals);

            const result = await mintToken(mockCctx, recipientAddress, amount);

            expect(result.ok).toBe(true);
            expect(singleTransfer).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                amount * Math.pow(10, decimals)
            );
        });
    });

    describe("Error cases", () => {
        it("should return error when admin wallet keypair is not configured", async () => {
            const cctxWithoutAdmin = createMockCliContextWithoutAdmin();
            const amount = 100;

            const result = await mintToken(cctxWithoutAdmin, recipientAddress, amount);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe("Admin wallet keypair is not configured in CLI context");
            }

            expect(mockCctx.program.methods.mintToken).not.toHaveBeenCalled();
        });

        it("should return error when program.mintToken fails", async () => {
            const amount = 100;
            const errorMessage = "Program execution failed";
            const mockRpc = jest.fn().mockRejectedValue(new Error(errorMessage));
            ((mockCctx.program.methods as any).mintToken as jest.Mock).mockReturnValue({
                rpc: mockRpc
            });

            const result = await mintToken(mockCctx, recipientAddress, amount);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe(errorMessage);
            }
        });

        it("should return error when getNumberOfDecimals fails", async () => {
            const amount = 100;
            const errorMessage = "Failed to get decimals";
            (utils.getNumberOfDecimals as jest.Mock).mockRejectedValue(new Error(errorMessage));

            const result = await mintToken(mockCctx, recipientAddress, amount);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe(errorMessage);
            }
        });

        it("should return error when getOrCreateAssociatedTokenAccount fails", async () => {
            const amount = 100;
            const errorMessage = "Failed to create token account";
            (getOrCreateAssociatedTokenAccount as jest.Mock).mockRejectedValue(new Error(errorMessage));

            const result = await mintToken(mockCctx, recipientAddress, amount);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe(errorMessage);
            }
        });

        it("should return error when singleTransfer fails", async () => {
            const amount = 100;
            const errorMessage = "Transfer failed";
            (singleTransfer as jest.Mock).mockResolvedValue(Err(errorMessage));

            const result = await mintToken(mockCctx, recipientAddress, amount);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe(errorMessage);
            }
        });

        it("should return error when singleTransfer throws an exception", async () => {
            const amount = 100;
            const errorMessage = "Transfer exception";
            (singleTransfer as jest.Mock).mockRejectedValue(new Error(errorMessage));

            const result = await mintToken(mockCctx, recipientAddress, amount);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe(errorMessage);
            }
        });

        it("should handle non-Error exceptions gracefully", async () => {
            const amount = 100;
            const mockRpc = jest.fn().mockRejectedValue("String error");
            ((mockCctx.program.methods as any).mintToken as jest.Mock).mockReturnValue({
                rpc: mockRpc
            });

            const result = await mintToken(mockCctx, recipientAddress, amount);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe("an unexpected error occurred");
            }
        });
    });

    describe("Edge cases", () => {
        it("should handle zero amount", async () => {
            const amount = 0;

            const result = await mintToken(mockCctx, recipientAddress, amount);

            expect(result.ok).toBe(true);
            expect(singleTransfer).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                0
            );
        });

        it("should handle very large amounts", async () => {
            const amount = 1000000;
            const decimals = 9;
            (utils.getNumberOfDecimals as jest.Mock).mockResolvedValue(decimals);

            const result = await mintToken(mockCctx, recipientAddress, amount);

            expect(result.ok).toBe(true);
            expect(singleTransfer).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                amount * Math.pow(10, decimals)
            );
        });

        it("should handle different decimal values correctly", async () => {
            const testCases = [
                { decimals: 0, amount: 100, expected: 100 },
                { decimals: 6, amount: 100, expected: 100000000 },
                { decimals: 9, amount: 100, expected: 100000000000 },
                { decimals: 18, amount: 1, expected: 1000000000000000000 }
            ];

            for (const testCase of testCases) {
                jest.clearAllMocks();
                (utils.getNumberOfDecimals as jest.Mock).mockResolvedValue(testCase.decimals);

                const result = await mintToken(mockCctx, recipientAddress, testCase.amount);

                expect(result.ok).toBe(true);
                expect(singleTransfer).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.anything(),
                    expect.anything(),
                    expect.anything(),
                    expect.anything(),
                    testCase.expected
                );
            }
        });
    });
});

