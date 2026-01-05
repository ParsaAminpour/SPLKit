import { PriorityLevel } from "../utils/transactionUtils";
import { MintToOp, TransferOp, SwapOp, BundleOp } from "../commands/writeOps/strategyBuilder"
import { Result, Ok, Err } from "../types/share";

type IndividualOperation = MintToOp | TransferOp | SwapOp;
type StrategyOperation = IndividualOperation | BundleOp;

const validateIndividualOperation = (op: IndividualOperation, idx: number, isBundled: boolean): Result => {
    switch (op.operation) {
        case "mintTo":
            if (op.amount == null || typeof op.amount !== "number" || op.amount <= 0) return Err(`Operation ${idx}: mintTo requires a positive 'amount' number`);
            if (!op.destinationAccount || typeof op.destinationAccount !== "string" || op.destinationAccount.trim() === "") return Err(`Operation ${idx}: mintTo requires a non-empty 'destinationAccount' string`);
            if (!op.priorityLevel) op.priorityLevel = PriorityLevel.MEDIUM
            if (op.priorityLevel > 4) return Err(`Operation ${idx}: invalid priority level`)
            break;
            
        case "transfer":
            if (op.amount == null || typeof op.amount !== "number" || op.amount <= 0) return Err(`Operation ${idx}: transfer requires a positive 'amount' number`);
            if (!isBundled && (!op.fromKp || typeof op.fromKp !== "string" || op.fromKp.trim() === "")) return Err(`Operation ${idx}: transfer requires a non-empty 'fromKp' string`);
            if (!op.toPk || typeof op.toPk !== "string" || op.toPk.trim() === "") return Err(`Operation ${idx}: transfer requires a non-empty 'toPk' string`);
            if (!op.priorityLevel) op.priorityLevel = PriorityLevel.MEDIUM
            if (op.priorityLevel > 4) return Err(`Operation ${idx}: invalid priority level`)
            break;
        
        case "swap":
            if (op.amount == null || typeof op.amount !== "number" || op.amount <= 0) return Err(`Operation ${idx}: swap requires a positive 'amount' number`);
            if (!op.inputMintPDA || typeof op.inputMintPDA !== "string" || op.inputMintPDA.trim() === "") return Err(`Operation ${idx}: swap requires a non-empty 'inputMintPDA' string`);
            if (!op.outputMintPDA || typeof op.outputMintPDA !== "string" || op.outputMintPDA.trim() === "") return Err(`Operation ${idx}: swap requires a non-empty 'outputMintPDA' string`);
            if (!isBundled && (!op.callerKp || typeof op.callerKp !== "string" || op.callerKp.trim() === "")) return Err(`Operation ${idx}: swap requires a non-empty 'callerKp' string`);
            if (op.inputMintPDA === op.outputMintPDA) return Err(`Operation ${idx}: swap requires 'inputMintPDA' and 'outputMintPDA' to be different`);
            if (!op.priorityLevel) op.priorityLevel = PriorityLevel.MEDIUM
            if (op.priorityLevel > 4) return Err(`Operation ${idx}: invalid priority level`)
            break;
    }
    return Ok();
}

// TODO : Estimate the transaction size in bundle operations and show warning if it exceeds the 1232bytes.
export const beforeStrategyOpsCheck = (
    ops: StrategyOperation[], 
    isScheduled: boolean
): Result => {
    const allIds: string[] = [];
    for (const op of ops) {
        allIds.push(op.id);
        if (op.operation === "bundle") {
            const bundleOp = op as BundleOp;
            for (const bundledOp of bundleOp.operations) {
                allIds.push(bundledOp.id);
            }
        }
    }
    
    if (Array.from(new Set(allIds)).length != allIds.length) {
        return Err("There is a duplication in operations id");
    }

    for (const [idx, op] of ops.entries()) {
        if ((!isScheduled && op.timeToExecute != null) || (isScheduled && op.timeToExecute == null)) {
            return Err(`'timeToExecute' must be null for unscheduled runs, and must be set for scheduled runs (operation No.${idx})`);
        }
        
        if (op.operation === "bundle") {
            const bundleOp = op as BundleOp;
            if (!bundleOp.operations || !Array.isArray(bundleOp.operations) || bundleOp.operations.length === 0) {
                return Err(`Operation ${idx}: bundle must contain a non-empty array of operations`);
            }
            if (!bundleOp.priorityLevel) bundleOp.priorityLevel = PriorityLevel.MEDIUM;
            if (bundleOp.priorityLevel > 4) return Err(`Operation ${idx}: invalid priority level for bundle`);
            
            for (const [bundleIdx, bundledOp] of bundleOp.operations.entries()) {
                const validationResult = validateIndividualOperation(bundledOp, bundleIdx, true);
                if (!validationResult.ok) {
                    return Err(`Bundle ${idx}, operation ${bundleIdx}: ${validationResult.error}`);
                }
            }
        } else {
            const validationResult = validateIndividualOperation(op as IndividualOperation, idx, false);
            if (!validationResult.ok) {
                return validationResult;
            }
        }
    }
    return Ok();
}

export const dataFormatForBatchTransferByLineCheck = (line: string): boolean => {
    const re = /^[1-9A-HJ-NP-Za-km-z]{32,44};\d+$/
    return re.test(line)
}