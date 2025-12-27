import { transferToken, nativeTransfer } from "../src/commands/writeOps/transfer";
import { createMockCliContext, createMockCliContextWithoutAdmin, createRecipientKeypair } from "./setup";
import { Ok, Err } from "../src/types/share";
import { PriorityLevel } from "../src/utils/transactionUtils";
import * as utils from "../src/utils/utils";
import { singleTransfer } from "../src/utils/transferUtils";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { PublicKey, Keypair, sendAndConfirmTransaction } from "@solana/web3.js";
import { confirmOrExit } from "../src/utils/messageUtils";
import { getPriorityFeeInfo } from "../src/utils/transactionUtils";

jest.mock("../src/utils/utils");
jest.mock("../src/utils/transferUtils");
jest.mock("../src/utils/transactionUtils");
jest.mock("../src/utils/messageUtils");
jest.mock("@solana/spl-token", () => ({
    ...jest.requireActual("@solana/spl-token"),
    getOrCreateAssociatedTokenAccount: jest.fn(),
    getAssociatedTokenAddressSync: jest.fn((_mint, _owner) => {
        return new PublicKey("11111111111111111111111111111112");
    })
}));
jest.mock("@solana/web3.js", () => ({
    ...jest.requireActual("@solana/web3.js"),
    sendAndConfirmTransaction: jest.fn(),
}));

describe("transferToken", () => {
    let mockCctx: ReturnType<typeof createMockCliContext>;
    let senderKeypair: Keypair;
    let recipientKeypair: ReturnType<typeof createRecipientKeypair>;
    let recipientAddress: string;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockCctx = createMockCliContext();
        senderKeypair = Keypair.generate();
        recipientKeypair = createRecipientKeypair();
        recipientAddress = recipientKeypair.publicKey.toBase58();
        
        (utils.getNumberOfDecimals as jest.Mock).mockResolvedValue(9);
        (getOrCreateAssociatedTokenAccount as jest.Mock).mockResolvedValue({
            address: new PublicKey("11111111111111111111111111111112")
        });
        (singleTransfer as jest.Mock).mockResolvedValue(Ok("mockTransferTxSignature"));
        (getPriorityFeeInfo as jest.Mock).mockResolvedValue(Ok(5000));
        (confirmOrExit as jest.Mock).mockResolvedValue(undefined);
        
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
        it("should successfully transfer tokens without asking before action", async () => {
            const amount = 100;
            const priorityLevel = PriorityLevel.MEDIUM;

            const result = await transferToken(mockCctx, senderKeypair, recipientAddress, amount, false, priorityLevel);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe("mockTransferTxSignature");
            }

            expect(utils.getNumberOfDecimals).toHaveBeenCalledWith(
                mockCctx.connection,
                mockCctx.itaTokenMintPDA
            );
            expect(getOrCreateAssociatedTokenAccount).toHaveBeenCalled();
            expect(singleTransfer).toHaveBeenCalledWith(
                mockCctx,
                senderKeypair,
                expect.any(PublicKey),
                expect.any(PublicKey),
                senderKeypair.publicKey,
                amount * Math.pow(10, 9),
                priorityLevel
            );
            expect(confirmOrExit).not.toHaveBeenCalled();
        });

        it("should successfully transfer tokens with askBeforeAction enabled", async () => {
            const amount = 100;
            const priorityLevel = PriorityLevel.MEDIUM;

            const result = await transferToken(mockCctx, senderKeypair, recipientAddress, amount, true, priorityLevel);

            expect(result.ok).toBe(true);
            expect(confirmOrExit).toHaveBeenCalledWith(
                "Do you want to proceed with the transfer using the above data?",
                "Transfer operation has been terminated by the user."
            );
        });

        it("should use default priority level when not provided", async () => {
            const amount = 50;

            const result = await transferToken(mockCctx, senderKeypair, recipientAddress, amount, false);

            expect(result.ok).toBe(true);
            expect(singleTransfer).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                PriorityLevel.MEDIUM
            );
        });

        it("should correctly calculate amount with decimals", async () => {
            const amount = 100;
            const decimals = 6;
            (utils.getNumberOfDecimals as jest.Mock).mockResolvedValue(decimals);

            const result = await transferToken(mockCctx, senderKeypair, recipientAddress, amount, false);

            expect(result.ok).toBe(true);
            expect(singleTransfer).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                amount * Math.pow(10, decimals),
                expect.anything()
            );
        });
    });

    describe("Error cases", () => {
        it("should return error when admin wallet keypair is not configured", async () => {
            const cctxWithoutAdmin = createMockCliContextWithoutAdmin();
            const amount = 100;

            const result = await transferToken(cctxWithoutAdmin, senderKeypair, recipientAddress, amount, false);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe("Admin wallet keypair is not configured in CLI context");
            }
            expect(singleTransfer).not.toHaveBeenCalled();
        });

        it("should return error when priority fee estimation fails in askBeforeAction", async () => {
            const amount = 100;
            (getPriorityFeeInfo as jest.Mock).mockResolvedValue(Err("Priority fee error"));

            const result = await transferToken(mockCctx, senderKeypair, recipientAddress, amount, true);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain("There is an error in fetching priority estimation fee");
            }
            expect(singleTransfer).not.toHaveBeenCalled();
        });

        it("should throw error when getNumberOfDecimals fails in askBeforeAction", async () => {
            const amount = 100;
            const errorMessage = "Failed to get decimals";
            (utils.getNumberOfDecimals as jest.Mock).mockRejectedValue(new Error(errorMessage));

            await expect(transferToken(mockCctx, senderKeypair, recipientAddress, amount, true))
                .rejects.toThrow(errorMessage);
        });

        it("should return error when getNumberOfDecimals fails in transfer execution", async () => {
            const amount = 100;
            (utils.getNumberOfDecimals as jest.Mock)
                .mockResolvedValueOnce(9)
                .mockRejectedValueOnce(new Error("Failed to get decimals"));

            const result = await transferToken(mockCctx, senderKeypair, recipientAddress, amount, true);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe("Failed to get decimals");
            }
        });

        it("should return error when getOrCreateAssociatedTokenAccount fails", async () => {
            const amount = 100;
            const errorMessage = "Failed to create token account";
            (getOrCreateAssociatedTokenAccount as jest.Mock).mockRejectedValue(new Error(errorMessage));

            const result = await transferToken(mockCctx, senderKeypair, recipientAddress, amount, false);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe(errorMessage);
            }
        });

        it("should return error when singleTransfer fails", async () => {
            const amount = 100;
            const errorMessage = "Transfer failed";
            (singleTransfer as jest.Mock).mockResolvedValue(Err(errorMessage));

            const result = await transferToken(mockCctx, senderKeypair, recipientAddress, amount, false);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe(errorMessage);
            }
        });

        it("should return error when singleTransfer throws an exception", async () => {
            const amount = 100;
            const errorMessage = "Transfer exception";
            (singleTransfer as jest.Mock).mockRejectedValue(new Error(errorMessage));

            const result = await transferToken(mockCctx, senderKeypair, recipientAddress, amount, false);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe(errorMessage);
            }
        });

        it("should handle non-Error exceptions gracefully", async () => {
            const amount = 100;
            (singleTransfer as jest.Mock).mockRejectedValue("String error");

            const result = await transferToken(mockCctx, senderKeypair, recipientAddress, amount, false);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe("an unexpected error occurred");
            }
        });
    });

    describe("Edge cases", () => {
        it("should handle zero amount", async () => {
            const amount = 0;

            const result = await transferToken(mockCctx, senderKeypair, recipientAddress, amount, false);

            expect(result.ok).toBe(true);
            expect(singleTransfer).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                0,
                expect.anything()
            );
        });

        it("should handle very large amounts", async () => {
            const amount = 1000000;
            const decimals = 9;
            (utils.getNumberOfDecimals as jest.Mock).mockResolvedValue(decimals);

            const result = await transferToken(mockCctx, senderKeypair, recipientAddress, amount, false);

            expect(result.ok).toBe(true);
            expect(singleTransfer).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                amount * Math.pow(10, decimals),
                expect.anything()
            );
        });
    });
});

describe("nativeTransfer", () => {
    let mockCctx: ReturnType<typeof createMockCliContext>;
    let senderKeypair: Keypair;
    let recipientKeypair: ReturnType<typeof createRecipientKeypair>;
    let recipientPublicKey: PublicKey;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockCctx = createMockCliContext();
        senderKeypair = Keypair.generate();
        recipientKeypair = createRecipientKeypair();
        recipientPublicKey = recipientKeypair.publicKey;
        
        (getPriorityFeeInfo as jest.Mock).mockResolvedValue(Ok(5000));
        (confirmOrExit as jest.Mock).mockResolvedValue(undefined);
        (sendAndConfirmTransaction as jest.Mock).mockResolvedValue("mockNativeTransferTxSignature");
        
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
        it("should successfully transfer native SOL without asking before action", async () => {
            const lamports = 1000000000;
            const priorityLevel = PriorityLevel.MEDIUM;

            const result = await nativeTransfer(mockCctx, senderKeypair, recipientPublicKey, lamports, false, priorityLevel);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe("mockNativeTransferTxSignature");
            }

            expect(getPriorityFeeInfo).toHaveBeenCalledWith(
                mockCctx.heliusSDK,
                mockCctx.configs.ita_token_mint_pda,
                priorityLevel
            );
            expect(sendAndConfirmTransaction).toHaveBeenCalled();
            expect(confirmOrExit).not.toHaveBeenCalled();
        });

        it("should successfully transfer native SOL with askBeforeAction enabled", async () => {
            const lamports = 1000000000;
            const priorityLevel = PriorityLevel.MEDIUM;

            const result = await nativeTransfer(mockCctx, senderKeypair, recipientPublicKey, lamports, true, priorityLevel);

            expect(result.ok).toBe(true);
            expect(confirmOrExit).toHaveBeenCalledWith(
                "Do you want to proceed with the SOL transfer using the above data?",
                "Native SOL transfer has been terminated by the user."
            );
        });

        it("should use default priority level when not provided", async () => {
            const lamports = 500000000;

            const result = await nativeTransfer(mockCctx, senderKeypair, recipientPublicKey, lamports, false);

            expect(result.ok).toBe(true);
            expect(getPriorityFeeInfo).toHaveBeenCalledWith(
                mockCctx.heliusSDK,
                mockCctx.configs.ita_token_mint_pda,
                PriorityLevel.MEDIUM
            );
        });

        it("should correctly convert lamports to SOL in preview", async () => {
            const lamports = 1500000000;

            const result = await nativeTransfer(mockCctx, senderKeypair, recipientPublicKey, lamports, true);

            expect(result.ok).toBe(true);
        });

        it("should handle different priority levels", async () => {
            const lamports = 1000000000;
            const priorityLevel = PriorityLevel.HIGH;

            const result = await nativeTransfer(mockCctx, senderKeypair, recipientPublicKey, lamports, false, priorityLevel);

            expect(result.ok).toBe(true);
            expect(getPriorityFeeInfo).toHaveBeenCalledWith(
                mockCctx.heliusSDK,
                mockCctx.configs.ita_token_mint_pda,
                priorityLevel
            );
        });
    });

    describe("Error cases", () => {
        it("should return error when priority fee estimation fails", async () => {
            const lamports = 1000000000;
            (getPriorityFeeInfo as jest.Mock).mockResolvedValue(Err("Priority fee error"));

            const result = await nativeTransfer(mockCctx, senderKeypair, recipientPublicKey, lamports, false);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain("There is an error in fetching priority estimation fee");
            }
            expect(sendAndConfirmTransaction).not.toHaveBeenCalled();
        });

        it("should return error when priority fee estimation fails in askBeforeAction", async () => {
            const lamports = 1000000000;
            (getPriorityFeeInfo as jest.Mock).mockResolvedValue(Err("Priority fee error"));

            const result = await nativeTransfer(mockCctx, senderKeypair, recipientPublicKey, lamports, true);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain("There is an error in fetching priority estimation fee");
            }
            expect(confirmOrExit).not.toHaveBeenCalled();
        });

        it("should return error when sendAndConfirmTransaction fails", async () => {
            const lamports = 1000000000;
            const errorMessage = "Transaction failed";
            (sendAndConfirmTransaction as jest.Mock).mockRejectedValue(new Error(errorMessage));

            const result = await nativeTransfer(mockCctx, senderKeypair, recipientPublicKey, lamports, false);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe(errorMessage);
            }
        });

        it("should handle non-Error exceptions gracefully", async () => {
            const lamports = 1000000000;
            (sendAndConfirmTransaction as jest.Mock).mockRejectedValue("String error");

            const result = await nativeTransfer(mockCctx, senderKeypair, recipientPublicKey, lamports, false);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe("an unexpected error occurred");
            }
        });
    });

    describe("Edge cases", () => {
        it("should handle zero lamports", async () => {
            const lamports = 0;

            const result = await nativeTransfer(mockCctx, senderKeypair, recipientPublicKey, lamports, false);

            expect(result.ok).toBe(true);
            expect(sendAndConfirmTransaction).toHaveBeenCalled();
        });

        it("should handle very large lamport amounts", async () => {
            const lamports = 1000000000000;

            const result = await nativeTransfer(mockCctx, senderKeypair, recipientPublicKey, lamports, false);

            expect(result.ok).toBe(true);
            expect(sendAndConfirmTransaction).toHaveBeenCalled();
        });

        it("should correctly calculate SOL amount from lamports in preview", async () => {
            const lamports = 2500000000;

            const result = await nativeTransfer(mockCctx, senderKeypair, recipientPublicKey, lamports, true);

            expect(result.ok).toBe(true);
        });
    });
});

