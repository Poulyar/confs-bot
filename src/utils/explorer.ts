/**
 * Returns a markdown link to a blockchain explorer for a given transaction hash and network.
 */
export const getExplorerLink = (network: string, txHash: string): string => {
    const explorers: Record<string, string> = {
        'TRC20': 'https://tronscan.org/#/transaction/',
        'ERC20': 'https://etherscan.io/tx/',
        'BEP20': 'https://bscscan.com/tx/',
        'SOL': 'https://solscan.io/tx/',
        'TON': 'https://tonviewer.com/transaction/',
    };

    const baseUrl = explorers[network.toUpperCase()];
    if (!baseUrl) return `\`${txHash}\``; // Return backticked hash if no explorer found

    return `[${txHash}](${baseUrl}${txHash})`;
};
