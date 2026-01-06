import { PriorityLevel } from "../utils/transactionUtils";
import { MintToOp, TransferOp, SwapOp, BundleOp, DepositOP } from "../commands/writeOps/strategyBuilder"
import { Result, Ok, Err } from "../types/share";
import fs from "fs"

type IndividualOperation = MintToOp | TransferOp | SwapOp | DepositOP;
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
            if (!op.signer) return Err(`Operation ${idx}: transfer requires a non-empty 'signer' string`);
            if (op.signer != "admin" && !fs.existsSync(op.signer!)) return Err(`Operation ${idx}: The selected signer path does not exist`)
            if (!isBundled && (!op.signer || typeof op.signer !== "string" || op.signer.trim() === "")) return Err(`Operation ${idx}: transfer requires a non-empty 'signer' string`);
            if (!op.toPk || typeof op.toPk !== "string" || op.toPk.trim() === "") return Err(`Operation ${idx}: transfer requires a non-empty 'toPk' string`);
            if (!op.priorityLevel) op.priorityLevel = PriorityLevel.MEDIUM
            if (op.priorityLevel > 4) return Err(`Operation ${idx}: invalid priority level`)
            break;
        
        case "swap":
            if (op.amount == null || typeof op.amount !== "number" || op.amount <= 0) return Err(`Operation ${idx}: swap requires a positive 'amount' number`);
            if (!op.signer) return Err(`Operation ${idx}: swap requires a non-empty 'signer' string`);
            if (op.signer != "admin" && !fs.existsSync(op.signer!)) return Err(`Operation ${idx}: The selected signer path does not exist`)
            if (!op.inputMintPDA || typeof op.inputMintPDA !== "string" || op.inputMintPDA.trim() === "") return Err(`Operation ${idx}: swap requires a non-empty 'inputMintPDA' string`);
            if (!op.outputMintPDA || typeof op.outputMintPDA !== "string" || op.outputMintPDA.trim() === "") return Err(`Operation ${idx}: swap requires a non-empty 'outputMintPDA' string`);
            if (!isBundled && (!op.signer || typeof op.signer !== "string" || op.signer.trim() === "")) return Err(`Operation ${idx}: swap requires a non-empty 'signer' string`);
            if (op.inputMintPDA === op.outputMintPDA) return Err(`Operation ${idx}: swap requires 'inputMintPDA' and 'outputMintPDA' to be different`);
            if (!op.priorityLevel) op.priorityLevel = PriorityLevel.MEDIUM
            if (op.priorityLevel > 4) return Err(`Operation ${idx}: invalid priority level`)
            break;

        case "deposit":
            if (op.amount == null || typeof op.amount !== "number" || op.amount <= 0) return Err(`Operation ${idx}: deposit requires a positive 'amount' number`);
            if (!op.signer) return Err(`Operation ${idx}: deposit requires a non-empty 'signer' string`);
            if (op.signer != "admin" && !fs.existsSync(op.signer!)) return Err(`Operation ${idx}: The selected signer path does not exist`)
            if (!op.priorityLevel) op.priorityLevel = PriorityLevel.MEDIUM
            if (op.priorityLevel > 4) return Err(`Operation ${idx}: invalid priority level`)
    }
    return Ok();
}

const validateBundledOperation = (op: BundleOp, idx: number): Result => {
    const bundleOp = op as BundleOp;
    if (!bundleOp.operations || !Array.isArray(bundleOp.operations) || bundleOp.operations.length === 0) {
        return Err(`Bundle operation ${bundleOp.id} must contain a non-empty array of operations`);
    }
    if (!bundleOp.signer) {
        return Err(`Bundle operation ${bundleOp.id} must have 'signer' specified at the bundle level`);
    }
    if (!bundleOp.priorityLevel) bundleOp.priorityLevel = PriorityLevel.MEDIUM;
    if (bundleOp.priorityLevel > 4) return Err(`Operation ${idx}: invalid priority level for bundle`);

    for (const [opIdx, op] of bundleOp.operations.entries()) {
        if (!op.operation || !["mintTo", "transfer", "swap", "deposit"].includes(op.operation)) {
            return Err(`Invalid operation type in bundle ${bundleOp.id}: ${op.operation}. Must be one of: mintTo, transfer, swap`);
        }
        const validationResult = validateIndividualOperation(op, opIdx, true);
        if (!validationResult.ok) {
            return Err(`Bundle ${idx}, operation ${opIdx}: ${validationResult.error}`);
        }
    }
    return Ok()
}

export const beforeStrategyOpsCheck = (
    ops: StrategyOperation[], 
    isScheduled: boolean
): Result => {
    // Unique ID check
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
        if (!op.operation || !["mintTo", "transfer", "swap", "deposit", "bundle"].includes(op.operation)) {
            return Err(`Invalid operation type: ${op.operation}. Must be one of: mintTo, transfer, swap, deposit, bundle`);
        }
        if ((!isScheduled && op.timeToExecute != null) || (isScheduled && op.timeToExecute == null)) {
            return Err(`'timeToExecute' must be null for unscheduled runs, and must be set for scheduled runs (operation No.${idx})`);
        }

        if (op.operation === "bundle") {
            const validateResul = validateBundledOperation(op as BundleOp, idx)
            if (!validateResul.ok) return Err(validateResul.error) 
        } else {
            const validationResult = validateIndividualOperation(op as IndividualOperation, idx, false);
            if (!validationResult.ok) return Err(validationResult.error);
        }
    }
    return Ok();
}


export const dataFormatForBatchTransferByLineCheck = (line: string): boolean => {
    const re = /^[1-9A-HJ-NP-Za-km-z]{32,44};\d+$/
    return re.test(line)
}