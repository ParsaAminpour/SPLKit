import { CliContext } from "@/index";
import { Result, Ok, Err } from "../../types/share";
import { SwapDirection } from "../writeOps/swap";
import { getPoolInfo } from "./poolInfo";

/*
 * Buy direction means buying base token and selling quote token and same statement in vice versa
 * Buying token B with amount Δx of token A: | x (base token), y (quote token)
 * (x + Δx × (1 - fee)) × (y - Δy) = k
 * Δy = y - (k / (x + Δx × (1 - fee)))
 * Price_before = y / x
 * Price_after = (y - Δy) / (x + Δx)
 * Effective_price = Δy / Δx
 * 
 * Simplidied formula (Buying Δx)  : P_new = y / (x - Δx) × (1 + Δx / ((x - Δx) × (1 - f)))
 * Simplidied formula (Selling Δx) : P_new = (y × x) / ((x + Δx) × (x + Δx × (1 - f)))
*/
export const getPricePredict = async(cctx: CliContext, _amountIn: number, direction: SwapDirection, _isBaseIn: boolean): Promise<Result<number>> => {
    const poolInfo = await getPoolInfo(cctx.configs.raydium_pool_id, cctx.configs.cluster)
    if (poolInfo == undefined) return Err("Pool info could not be retrieved for the provided pool ID.")
    const mintAReserve = BigInt(Math.floor(poolInfo.mintAmountA * 1e9)) // SOL
    const mintBReserve = BigInt(Math.floor(poolInfo.mintAmountB * 1e9)) // ITA
    const amountIn = BigInt(Math.floor(_amountIn))
    const k = mintAReserve * mintBReserve
    const feeNumerator = BigInt(Math.floor((1 - poolInfo.feeRate) * 10000));
    const feeDenominator = BigInt(10000);

    let newPrice: number;
    const priceImpact = calculatePriceImpact(Number(mintAReserve), Number(mintBReserve), Number(amountIn), poolInfo.feeRate)
    if (direction == SwapDirection.BUY) {
        // For buying Δy ITA by selling SOL (Δx) -> amountIn ~ amount ITA you want to buy
        // newPrice = (mintBReserve - amountIn) / (mintAReserve + (mintAReserve * amountIn) / (((mintBReserve - amountIn) * (feeNumerator)) / feeDenominator))
        const yNew = mintBReserve - amountIn;  
        const xNew_before_fee = k / yNew;        
        const deltaX_before_fee = xNew_before_fee - mintAReserve;
        const deltaX_with_fee = (deltaX_before_fee * feeDenominator) / feeNumerator;
        const xFinal = mintAReserve + deltaX_with_fee;
        const yFinal = mintBReserve - amountIn;        
        newPrice = Number(yFinal) / Number(xFinal);

    } else {
        const deltaY_after_fee = (amountIn * feeNumerator) / feeDenominator;
        const yNew = mintBReserve + deltaY_after_fee;
        const xNew = k / yNew;
        const xFinal = xNew;
        const yFinal = mintBReserve + amountIn;
        newPrice = Number(yFinal) / Number(xFinal);
    }

    console.log("old price: ", poolInfo.price) // ? ITA per SOL
    console.log(`Price impact: ${priceImpact.toFixed(2)}%`)
    direction == SwapDirection.BUY
        ? console.log(`new price after Buy: ${newPrice} | ${newPrice - (newPrice * (priceImpact/100))} (with price impact)`)
        : console.log(`new price after Sell: ${newPrice} | ${newPrice + (newPrice * (priceImpact/100))} (with price impact)`)
    return Ok(1)
}

/* 
* @param reserveInput - Reserve of the token being sold (in raw units, e.g., 1e9 format)
* @param reserveOutput - Reserve of the token being bought (in raw units, e.g., 1e9 format)
* @param amountIn - Amount of input token to swap (in raw units, e.g., 1e9 format)
* @param fee - Trading fee as decimal (e.g., 0.0025 for 0.25%)
* @returns Price impact as a percentage (e.g., 7.5 for 7.5%)
*/
export const calculatePriceImpact = (
    reserveInput: number,
    reserveOutput: number,
    amountIn: number,
    fee: number = 0.0025
): number => {
    const amountInAfterFee = amountIn * (1 - fee);
    // Calculate output amount using CPMM formula: (x + Δx) × (y - Δy) = k
    const amountOut = (reserveOutput * amountInAfterFee) / (reserveInput + amountInAfterFee);
    const currentPrice = reserveOutput / reserveInput;
    const effectivePrice = amountOut / amountIn;
    const priceImpact = Math.abs((effectivePrice - currentPrice) / currentPrice) * 100;
    return priceImpact;
}

export const getPricePredictHandler = async(cctx: CliContext, options: any) => {
    await getPricePredict(cctx, options.amountIn, options.direction == "buy" ? SwapDirection.BUY : SwapDirection.SELL, options.base)
}