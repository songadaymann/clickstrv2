/**
 * Games/Seasons configuration
 *
 * Each game is a separate contract deployment with its own subgraph.
 * This config tracks all games for leaderboard history.
 */

export interface GameConfig {
  id: string;
  name: string;
  subgraphUrl: string;
  contractAddress: string;
  startDate?: string;        // ISO date string
  endDate?: string | null;   // ISO date string, null if ongoing
  isActive: boolean;         // Is this the current game?
  isBeta: boolean;           // Beta games get "Beta Game X" naming
}

/**
 * All games in chronological order
 * Add new games to the end of this array
 */
export const GAMES: GameConfig[] = [
  {
    id: 'beta-1',
    name: 'Beta Game 1',
    subgraphUrl: 'https://api.goldsky.com/api/public/project_cmit79ozucckp01w991mfehjs/subgraphs/clickstr-sepolia/1.0.0/gn',
    contractAddress: '0x6dD800B88FEecbE7DaBb109884298590E5BbBf20',
    startDate: '2025-01-31',
    endDate: '2025-01-31',
    isActive: false,
    isBeta: true,
  },
  {
    id: 'beta-2',
    name: 'Beta Game 2',
    subgraphUrl: 'https://api.goldsky.com/api/public/project_cmit79ozucckp01w991mfehjs/subgraphs/clickstr-sepolia/1.0.3/gn',
    contractAddress: '0xA16d45e4D186B9678020720BD1e743872a6e9bA0',
    startDate: '2026-02-02',
    endDate: '2026-02-03',
    isActive: false,
    isBeta: true,
  },
  {
    id: 'beta-3',
    name: 'Beta Game 3',
    subgraphUrl: 'https://api.goldsky.com/api/public/project_cmit79ozucckp01w991mfehjs/subgraphs/clickstr-sepolia/1.0.4/gn',
    contractAddress: '0xf724ede44Bbb2Ccf46cec530c21B14885D441e02',
    startDate: '2026-02-03',
    endDate: '2026-02-04',
    isActive: false,
    isBeta: true,
  },
  {
    id: 'season-1',
    name: 'Season 1',
    subgraphUrl: 'https://api.goldsky.com/api/public/project_cmit79ozucckp01w991mfehjs/subgraphs/clickstr-mainnet/1.0.0/gn',
    contractAddress: '0xf724ede44Bbb2Ccf46cec530c21B14885D441e02',
    startDate: '2026-02-04',
    endDate: '2026-02-07',
    isActive: true,
    isBeta: false,
  },
];

/**
 * Get the currently active game
 */
export function getCurrentGame(): GameConfig | undefined {
  return GAMES.find(g => g.isActive);
}

/**
 * Get a game by ID
 */
export function getGameById(id: string): GameConfig | undefined {
  return GAMES.find(g => g.id === id);
}

/**
 * Get all completed games (for history)
 */
export function getCompletedGames(): GameConfig[] {
  return GAMES.filter(g => !g.isActive && g.endDate);
}

/**
 * Get all games (for full leaderboard modal)
 */
export function getAllGames(): GameConfig[] {
  return GAMES;
}
