import { consola } from "consola";

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

export const showFailure = (message: string, details?: Detail) => {
    const extra = formatDetails(details);
    extra ? consola.error(message, "\n", extra) : consola.error(message);
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
        consola.info("\nSwap operation has been cancelled.");
        process.exit(0);
    }
}