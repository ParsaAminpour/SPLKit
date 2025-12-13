import { CliContext } from "@/index";
import { showFailure, startStep, showSuccess } from "../../utils/messageUtils";
import { PublicKey } from "@metaplex-foundation/js";
import Table from 'cli-table3';
import { consola } from "consola";
import { formatNumber, formatPercentage } from "../../utils/messageUtils";
import * as constant from "../constants"

interface Config {
    id: string,
    index: number,
    protocolFeeRate: number,
    tradeFeeRate: number,
    fundFeeRate: number,
    createPoolFee: string,
    creatorFeeRate: number
}

interface TimeRangeInfo {
    volume: number,
    volumeQuote: number,
    volumeFee: number,
    apr: number,
    feeApr: number,
    priceMin: number,
    priceMax: number,
    rewardApr: any,
}

interface LPTokenInfo {
    name: string,
    symbol: string,
    address: PublicKey,
    programId: PublicKey,
    decimal: number,
    url: string
}

export interface PoolInfo {
    type: string,
    poolType: string,
    programId: PublicKey,
    poolConfig: Config,
    price: number,
    mintAmountA: number,
    mintAmountB: number,
    feeRate: number,
    tvl: number,
    daily: TimeRangeInfo,
    weekly: TimeRangeInfo,
    monthly: TimeRangeInfo,
    LPMint: LPTokenInfo,
    lpPrice: number,
    lpAmount: number,
    burnPercent: number
}

export const getPoolInfo = async(poolId: string, cluster: string = "devnet"): Promise<PoolInfo | undefined> => {
    const apiBaseURL = cluster == "devnet" ? constant.raydiumDevnetAPIV3BaseURL : constant.raydiumMainnetAPIV3BaseURL
    const url = `${apiBaseURL}pools/info/ids?ids=${poolId}`;
    const reqBody: RequestInit = {
        method: "GET",
        headers: { accept: "application/json" },
    };

    try {
        const response = await fetch(url, reqBody);
        const data = (await response.json() as any).data;
        if (!data || !data[0]) {
            showFailure("No pool data found for the provided pool ID");
            return undefined;
        }
        const rawData = data[0];
        const poolInfo: PoolInfo = {
            type: rawData.type,
            poolType: rawData.pooltype[0],
            programId: new PublicKey(rawData.programId),
            poolConfig: {
                id: rawData.config.id,
                index: rawData.config.index,
                protocolFeeRate: rawData.config.protocolFeeRate,
                tradeFeeRate: rawData.config.tradeFeeRate,
                fundFeeRate: rawData.config.fundFeeRate,
                createPoolFee: rawData.config.createPoolFee,
                creatorFeeRate: rawData.config.creatorFeeRate
            },
            price: rawData.price,
            mintAmountA: rawData.mintAmountA,
            mintAmountB: rawData.mintAmountB,
            feeRate: rawData.feeRate,
            tvl: rawData.tvl,
            daily: {
                volume: rawData.day.volume,
                volumeQuote: rawData.day.volumeQuote,
                volumeFee: rawData.day.volumeFee,
                apr: rawData.day.apr,
                feeApr: rawData.day.feeApr,
                priceMin: rawData.day.priceMin,
                priceMax: rawData.day.priceMax,
                rewardApr: rawData.day.rewardApr
            },
            weekly: {
                volume: rawData.week.volume,
                volumeQuote: rawData.week.volumeQuote,
                volumeFee: rawData.week.volumeFee,
                apr: rawData.week.apr,
                feeApr: rawData.week.feeApr,
                priceMin: rawData.week.priceMin,
                priceMax: rawData.week.priceMax,
                rewardApr: rawData.week.rewardApr
            },
            monthly: {
                volume: rawData.month.volume,
                volumeQuote: rawData.month.volumeQuote,
                volumeFee: rawData.month.volumeFee,
                apr: rawData.month.apr,
                feeApr: rawData.month.feeApr,
                priceMin: rawData.month.priceMin,
                priceMax: rawData.month.priceMax,
                rewardApr: rawData.month.rewardApr
            },
            LPMint: {
                name: rawData.lpMint.name,
                symbol: rawData.lpMint.symbol,
                address: new PublicKey(rawData.lpMint.address),
                programId: new PublicKey(rawData.lpMint.programId),
                decimal: rawData.lpMint.decimal,
                url: rawData.lpMint.url
            },
            lpPrice: rawData.lpPrice,
            lpAmount: rawData.lpAmount,
            burnPercent: rawData.burnPercent
        };
        return poolInfo

    } catch (error: any) {
        showFailure(error.message);
        throw error;
    }
}


const displayPoolInfo = (poolInfo: PoolInfo) => {    
    const basicTable = new Table({
        head: ['Property', 'Value'],
        style: { head: ['cyan'] }
    });
    basicTable.push(
        ['Type', poolInfo.type],
        ['Pool Type', poolInfo.poolType],
        ['Program ID', poolInfo.programId.toString()],
        ['Price', formatNumber(poolInfo.price)],
        ['TVL', `$${formatNumber(poolInfo.tvl)}`],
        ['Fee Rate', formatPercentage(poolInfo.feeRate)],
        ['Mint Amount A', formatNumber(poolInfo.mintAmountA)],
        ['Mint Amount B', formatNumber(poolInfo.mintAmountB)]
    );
    consola.box('📊 Pool Information');
    console.log(basicTable.toString());
    consola.log('\n');

    const configTable = new Table({
        head: ['Config Property', 'Value'],
        style: { head: ['cyan'] }
    });
    configTable.push(
        ['Config ID', poolInfo.poolConfig.id],
        ['Index', poolInfo.poolConfig.index.toString()],
        ['Protocol Fee Rate', formatPercentage(poolInfo.poolConfig.protocolFeeRate)],
        ['Trade Fee Rate', formatPercentage(poolInfo.poolConfig.tradeFeeRate)],
        ['Fund Fee Rate', formatPercentage(poolInfo.poolConfig.fundFeeRate)],
        ['Creator Fee Rate', formatPercentage(poolInfo.poolConfig.creatorFeeRate)],
        ['Create Pool Fee', poolInfo.poolConfig.createPoolFee]
    );
    consola.box('⚙️  Pool Configuration');
    console.log(configTable.toString());
    consola.log('\n');

    // const lpTable = new Table({
    //     head: ['Property', 'Value'],
    //     style: { head: ['cyan'] }
    // });
    // lpTable.push(
    //     ['Name', poolInfo.LPMint.name],
    //     ['Symbol', poolInfo.LPMint.symbol],
    //     ['Address', poolInfo.LPMint.address.toString()],
    //     ['Program ID', poolInfo.LPMint.programId.toString()],
    //     ['Decimals', poolInfo.LPMint.decimal],
    //     ['LP Price', formatNumber(poolInfo.lpPrice)],
    //     ['LP Amount', formatNumber(poolInfo.lpAmount)],
    //     ['Burn Percent', formatPercentage(poolInfo.burnPercent)],
    //     ['URL', poolInfo.LPMint.url || 'N/A']
    // );
    // consola.box('🪙 LP Token Information');
    // console.log(lpTable.toString());
    // consola.log('\n');

    const timeRangeTable = new Table({
        head: ['Metric', 'Daily', 'Weekly', 'Monthly'],
        style: { head: ['cyan'] }
    });
    
    const formatTimeRangeValue = (value: number | any, isPercentage: boolean = false): string => {
        if (value === null || value === undefined) return 'N/A';
        if (typeof value === 'object') return JSON.stringify(value);
        if (isPercentage) return formatPercentage(value);
        return formatNumber(value);
    };

    timeRangeTable.push(
        ['Volume', formatTimeRangeValue(poolInfo.daily.volume), formatTimeRangeValue(poolInfo.weekly.volume), formatTimeRangeValue(poolInfo.monthly.volume)],
        ['Volume Quote', formatTimeRangeValue(poolInfo.daily.volumeQuote), formatTimeRangeValue(poolInfo.weekly.volumeQuote), formatTimeRangeValue(poolInfo.monthly.volumeQuote)],
        ['Volume Fee', formatTimeRangeValue(poolInfo.daily.volumeFee), formatTimeRangeValue(poolInfo.weekly.volumeFee), formatTimeRangeValue(poolInfo.monthly.volumeFee)],
        ['APR', formatTimeRangeValue(poolInfo.daily.apr, true), formatTimeRangeValue(poolInfo.weekly.apr, true), formatTimeRangeValue(poolInfo.monthly.apr, true)],
        ['Fee APR', formatTimeRangeValue(poolInfo.daily.feeApr, true), formatTimeRangeValue(poolInfo.weekly.feeApr, true), formatTimeRangeValue(poolInfo.monthly.feeApr, true)],
        ['Price Min', formatTimeRangeValue(poolInfo.daily.priceMin), formatTimeRangeValue(poolInfo.weekly.priceMin), formatTimeRangeValue(poolInfo.monthly.priceMin)],
        ['Price Max', formatTimeRangeValue(poolInfo.daily.priceMax), formatTimeRangeValue(poolInfo.weekly.priceMax), formatTimeRangeValue(poolInfo.monthly.priceMax)],
        ['Reward APR', formatTimeRangeValue(poolInfo.daily.rewardApr, true), formatTimeRangeValue(poolInfo.weekly.rewardApr, true), formatTimeRangeValue(poolInfo.monthly.rewardApr, true)]
    );
    consola.box('📈 Time Range Statistics');
    console.log(timeRangeTable.toString());
    consola.log('\n');
};

export const poolInfo = async(cctx: CliContext, options: any): Promise<any> => {
    if (!options.poolid) {
        showFailure("The pool id option is mandatory")
        return
    }
    try {
        startStep(`Fetching pool information for pool ID: ${options.poolid}`);
        const poolInfo = await getPoolInfo(options.poolid, cctx.configs.cluster)
        if (poolInfo == undefined) {
             showFailure("There is an error in getting pool info")
            return 
        }
        displayPoolInfo(poolInfo);
        showSuccess("Pool information retrieved successfully");

        return poolInfo;
    } catch (error: any) {
        showFailure(error.message);
        throw error;
    }
}

export const getPoolPrice = async(cctx : CliContext, options: any): Promise<any> => {
    if (!options.poolid) {
        showFailure("The pool id option is mandatory")
        return
    }
    try {
        startStep(`Fetching pool price for pool ID: ${options.poolid}`);
        const poolInfo = await getPoolInfo(options.poolid, cctx.configs.cluster)
        if (poolInfo == undefined) {
            showFailure("There is an error in getting pool info")
           return 
       }
        const price = poolInfo.price;
        
        const priceTable = new Table({
            head: ['Pool ID', 'Price'],
            style: { head: ['cyan'] }
        });
        priceTable.push([options.poolid, formatNumber(price)]);        
        console.log(priceTable.toString());
        return price;
    } catch (error: any) {
        showFailure(error.message);
        throw error;
    }
}

// export const getPriceHistory = async(_: CliContext, options: any): Promise<any> => {
//     // TODO : Complete here..
//     return options
// }

export const getPoolStats = async(cctx: CliContext, options: any) => {
    if (!options.poolid) {
        showFailure("The pool id option is mandatory");
        return;
    }
    try {
        startStep(`Fetching pool statistics for pool ID: ${options.poolid}`);
        const poolInfo = await getPoolInfo(options.poolid, cctx.configs.cluster);
        if (poolInfo == undefined) {
            showFailure("There is an error in getting pool info");
            return;
        }

        const statsTable = new Table({
            head: ['Metric', 'Value'],
            style: { head: ['cyan'] }
        });
        
        statsTable.push(
            ['LP Price', formatNumber(poolInfo.lpPrice)],
            ['LP Amount', formatNumber(poolInfo.lpAmount)],
            ['TVL', `$${formatNumber(poolInfo.tvl)}`],
            ['Fee Rate', formatPercentage(poolInfo.feeRate)],
            ['Daily Volume', `$${formatNumber(poolInfo.daily.volume)}`],
            ['Weekly Volume', `$${formatNumber(poolInfo.weekly.volume)}`],
            ['Monthly Volume', `$${formatNumber(poolInfo.monthly.volume)}`]
        );
        
        consola.box('📊 Pool Statistics');
        console.log(statsTable.toString());
        consola.log('\n');
        showSuccess("Pool statistics retrieved successfully");
    } catch (error: any) {
        showFailure(error.message);
        throw error;
    }
}