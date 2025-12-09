import { web3 } from "@coral-xyz/anchor";

export const confirmTransaction = async (
    connection: web3.Connection,
    signature: web3.TransactionSignature,
    desiredConfirmationStatus: web3.TransactionConfirmationStatus = 'confirmed',
    timeout: number = 30000,
    pollInterval: number = 1000,
    searchTransactionHistory: boolean = false
  ): Promise<web3.SignatureStatus> => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const { value: statuses } = await connection.getSignatureStatuses([signature], { searchTransactionHistory });
        if (!statuses || statuses.length === 0) {
            throw new Error('Failed to get signature status');
        }
        const status = statuses[0];
        if (status === null) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
        }
        if (status.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
  
        if (status.confirmationStatus && status.confirmationStatus === desiredConfirmationStatus) return status;
  
        if (status.confirmationStatus === 'finalized') return status;
  
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    throw new Error(`Transaction confirmation timeout after ${timeout}ms`);
  }