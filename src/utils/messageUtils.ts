import { NATIVE_MINT } from "@solana/spl-token";
import { consola } from "consola";
import { logger } from "./logger"

type Detail = string | string[];

const formatDetails = (details?: Detail): string | undefined => {
    if (!details) return undefined;
    const parts = Array.isArray(details) ? details : [details];
    return parts.filter(Boolean).join("\n");
};

export const showInfo = (message: string, details?: Detail) => {
    const extra = formatDetails(details);
    extra ? consola.info(message, "\n", extra) : consola.info(message);
};

export const showSuccess = (message: string, details?: Detail) => {
    const extra = formatDetails(details);
    extra ? consola.success(message, "\n", extra) : consola.success(message);
};

export const showWarning = (message: string, details?: Detail) => {
    const extra = formatDetails(details);
    extra ? consola.warn(message, "\n", extra) : consola.warn(message);
};

export const showFailure = (message: string, _details?: Detail) => {
    const extra = formatDetails(_details);
    extra 
        ? logger.error(`${message}\n${extra}`)
        : logger.error(message);
};

export const showFailureAndReturn = (message: string, details?: Detail): never => {
    const extra = formatDetails(details);
    extra ? consola.error(message, "\n", extra) : consola.error(message);
    process.exit(1);
};

export const startStep = (message: string) => consola.start(message);

export const explorerLink = (signature: string, cluster: string = "devnet") =>
    `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;

export const formatNumber = (num: number): string => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(4);
};

export const formatPercentage = (num: number): string => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    return `${(num * 100).toFixed(2)}%`;
};

export const printSimulateInfo = () => {
    console.log(
      'you can paste simulate tx string here: https://explorer.solana.com/tx/inspector and click simulate to check transaction status'
    )
    console.log(
      'if tx simulate successful but did not went through successfully after running execute(xxx), usually means your txs were expired, try set up higher priority fees'
    )
    console.log('strongly suggest use paid rpcs would get you better performance')
}

export const confirmOrExit = async (ask: string, noCallbackMessage: string) => {
    try {
        const answer = await consola.prompt(ask, {
            type: "select",
            options: [
                "yes", "no"
            ]
        })
        if (answer === "no" || !answer) {
            consola.info(noCallbackMessage);
            process.exit(0);
        }
    } catch (error) {
        // Handle Ctrl+C or other interruptions
        consola.info("\nOperation has been cancelled.");
        process.exit(0);
    }
}

export const transferCallbackMessage = (isFailed: boolean, txId?: string, reason?: string) => {
    if (isFailed) {
        const message = "Transfer Transaction Failed! ❌";
        const details = reason ? `Reason: ${reason}` : "No transaction ID available";
        showFailure(message, details);
    } else {
        const message = "Transfer Transaction Success! 🎉";
        const details = txId 
            ? explorerLink(txId)
            : undefined;
        showSuccess(message, details);
    }
}

export const transferNativeCallbackMessage = (isFailed: boolean, txId?: string, reason?: string) => {
    if (isFailed) {
        const message = "Transfer Transaction Failed! ❌";
        const details = reason ? `Reason: ${reason}` : "No transaction ID available";
        showFailure(message, details);
    } else {
        const message = "Transfer (SOL) Transaction Success! 🎉";
        const details = txId 
            ? explorerLink(txId)
            : undefined;
        showSuccess(message, details);
    }
}

export const mintCallbackMessage = (isFailed: boolean, txId?: string, reason?: string) => {
    if (isFailed) {
        const message = "Mint Transaction Failed! ❌";
        const details = reason ? `Reason: ${reason}` : "No transaction ID available";
        showFailure(message, details);
    } else {
        const message = "Mint Transaction Success! 🎉";
        const details = txId 
            ? explorerLink(txId)
            : undefined;
        showSuccess(message, details);
    }
}

export const swapCallbackMessage = (isFailed: boolean, txId?: string, reason?: string) => {
    if (isFailed) {
        const message = "Swap Transaction Failed! ❌";
        const details = reason ? `Reason: ${reason}` : "No transaction ID available";
        showFailure(message, details);
    } else {
        const message = "Swap Transaction Success! 🎉";
        const details = txId 
            ? explorerLink(txId)
            : undefined;
        showSuccess(message, details);
    }
}

export const strategyCallbackMessage = (isFailed: boolean, successCount?: number, failureCount?: number, reason?: string) => {
    if (isFailed) {
        const message = "Strategy Execution Failed! ❌";
        const details = reason ? `Reason: ${reason}` : "One or more operations in the strategy failed";
        showFailure(message, details);
    } else {
        let message = `Strategy Execution Success! 🎉 (${successCount} succeeded, ${failureCount} failed)\n`;
        message += "All logs recorded in the logs folder\n";
        showSuccess(message);
    }
}

export const transferProcessingMessage = (from: string, to: string, amount: number) => {
    const fromShort = `${from.slice(0, 4)}...${from.slice(-4)}`;
    const toShort = `${to.slice(0, 4)}...${to.slice(-4)}`;
    startStep(`Transfering ${amount} amount of token from ${fromShort} to ${toShort}`);
}

export const mintProcessingMessage = (to: string, amount: number) => {
    const toShort = `${to.slice(0, 4)}...${to.slice(-4)}`;
    startStep(`Minting ${amount} amount of token to ${toShort}`);
}

export const swapProcessingMessage = (inputMintPDA: string, amount: number) => {
    const [inputMintSymbol, outputMintSymbol] = inputMintPDA == NATIVE_MINT.toBase58() ? ["SOL", "ITA"] : ["ITA", "SOL"]
    startStep(`Swapping ${amount} amount from $${inputMintSymbol} to $${outputMintSymbol}`);
}

export const strategyProcessingMessage = () => startStep("Executing strategy...");
