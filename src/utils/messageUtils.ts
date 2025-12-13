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