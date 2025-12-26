import { PriorityLevel } from "@/utils/transactionUtils";
import { MintToOp, TransferOp, SwapOp } from "../commands/writeOps/strategyBuilder"
import { Result, Ok, Err } from "../types/share";

export const beforeStrategyOpsCheck = <T extends MintToOp | TransferOp | SwapOp>(
    ops: T[], 
    isScheduled: boolean
): Result => {
    if (Array.from(new Set(ops.map(op => op.id))).length != ops.length) return Err("There is a duplication in operations id")

    for (const [idx, op] of ops.entries()) {
    if ((!isScheduled && op.timeToExecute != null) || (isScheduled && op.timeToExecute == null)) {
        return Err(`'timeToExecute' must be null for unscheduled runs, and must be set for scheduled runs (operation No.${idx})`);
    }
    switch (op.operation) {
        case "mintTo":
            if (op.amount == null || typeof op.amount !== "number" || op.amount <= 0) return Err(`Operation ${idx}: mintTo requires a positive 'amount' number`);
            if (!op.destinationAccount || typeof op.destinationAccount !== "string" || op.destinationAccount.trim() === "") return Err(`Operation ${idx}: mintTo requires a non-empty 'destinationAccount' string`);
            if (!op.priorityLevel) op.priorityLevel = PriorityLevel.MEDIUM
            if (op.priorityLevel > 4) return Err(`Operation ${idx}: invalid priority level`)
            break;
            
        case "transfer":
            if (op.amount == null || typeof op.amount !== "number" || op.amount <= 0) return Err(`Operation ${idx}: transfer requires a positive 'amount' number`);
            if (!op.fromKp || typeof op.fromKp !== "string" || op.fromKp.trim() === "") return Err(`Operation ${idx}: transfer requires a non-empty 'fromKp' string`);
            if (!op.toPk || typeof op.toPk !== "string" || op.toPk.trim() === "") return Err(`Operation ${idx}: transfer requires a non-empty 'toPk' string`);
            if (!op.priorityLevel) op.priorityLevel = PriorityLevel.MEDIUM
            if (op.priorityLevel > 4) return Err(`Operation ${idx}: invalid priority level`)
            break;
        
        case "swap":
            if (op.amount == null || typeof op.amount !== "number" || op.amount <= 0) return Err(`Operation ${idx}: swap requires a positive 'amount' number`);
            if (!op.inputMintPDA || typeof op.inputMintPDA !== "string" || op.inputMintPDA.trim() === "") return Err(`Operation ${idx}: swap requires a non-empty 'inputMintPDA' string`);
            if (!op.outputMintPDA || typeof op.outputMintPDA !== "string" || op.outputMintPDA.trim() === "") return Err(`Operation ${idx}: swap requires a non-empty 'outputMintPDA' string`);
            if (!op.callerKp || typeof op.callerKp !== "string" || op.callerKp.trim() === "") return Err(`Operation ${idx}: swap requires a non-empty 'callerKp' string`);
            if (op.inputMintPDA === op.outputMintPDA) return Err(`Operation ${idx}: swap requires 'inputMintPDA' and 'outputMintPDA' to be different`);
            if (!op.priorityLevel) op.priorityLevel = PriorityLevel.MEDIUM
            if (op.priorityLevel > 4) return Err(`Operation ${idx}: invalid priority level`)
            break;
        }
    }
    return Ok();
}

export const dataFormatForBatchTransferByLineCheck = (line: string): boolean => {
    const re = /^[1-9A-HJ-NP-Za-km-z]{32,44};\d+$/
    return re.test(line)
}