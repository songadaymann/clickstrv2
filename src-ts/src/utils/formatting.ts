/**
 * Formatting utilities
 */

/**
 * Format a number with K/M suffixes
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

/**
 * Format token amounts with appropriate precision
 */
export function formatTokens(amount: number): string {
  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toFixed(2) + 'M';
  } else if (amount >= 1_000) {
    return (amount / 1_000).toFixed(2) + 'K';
  } else {
    return amount.toFixed(2);
  }
}

/**
 * Format token amounts split into number and suffix (for seven-segment displays)
 */
export function formatTokensSplit(amount: number): { value: string; suffix: string } {
  if (amount >= 1_000_000) {
    return { value: (amount / 1_000_000).toFixed(2), suffix: 'M' };
  } else if (amount >= 1_000) {
    return { value: (amount / 1_000).toFixed(2), suffix: 'K' };
  } else {
    return { value: amount.toFixed(2), suffix: '' };
  }
}

/**
 * Format token amounts for display (older style)
 */
export function formatTokensLegacy(amount: number): string {
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(1) + 'M';
  if (amount >= 1_000) return (amount / 1_000).toFixed(1) + 'K';
  if (amount >= 1) return amount.toFixed(1);
  if (amount > 0) return amount.toFixed(4);
  return '0';
}

/**
 * Shorten an Ethereum address for display
 */
export function shortenAddress(addr: string | null | undefined): string {
  if (!addr) return 'Anonymous';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

/**
 * Format a date for display
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString();
}

/**
 * Format a duration in seconds to human readable
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}
