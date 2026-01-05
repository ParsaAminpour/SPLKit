import { PublicKey } from "@solana/web3.js";

export const ITA_TOKEN_SEED = "ita_token_seed"
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
export const BPS_RATIO = 10_000;
export const TX_INTERVAL = 1000;
export const MAX_TRANSACTION_SIZE_BYTES = 1232

export const raydiumDevnetPrograms = {
    launchLab: "DRay6fNdQ5J82H7xV6uq2aV3mWzUZ1J4PgSKsWgptcm6",
    cpmm: "DRaycpLY18LhpbydsBNbVJtxpNv9oXPg1RSifpF2bWpYb",
    legacyAMM: "DRaya7Kj3aMWQSy19kSjvmuwq9docCHoEyP9kanQ6aav",
    stableSwapAMM: "DRayDdXc1NZQ9C3hRWmoSf8zK4iapgMnJdNZNrfwsP8m",
    clmm: "DRayAUgENGQBKVaX8owNhgzkeDpyoHTGVEGHVJT1E9pEH",
    burnAndEarn: "DRay25Usp3YJA17beckgpGUC7mGJ2cR1AVPxhYYwVCUX",
    ammRouting: "DRaybByLpbUL57LJARsj3B8itTxvfzBg35iEaMz5UTCd",
    staking: "DRayMyrLmEW5KEeqSBkdTMaBaBapqagaBC7KWpGt3eZ",
    farmStaking: "DRay1CGSZgku1GTK6xXD6mVDd1ngXy6APAHiRk6R5L2LC",
    ecosystemFarm: "DRayzbYaXks45ELHkzH6vC3EuhQqTAnv5A68gdFuvZyZ"
};

export const raydiumDevnetAccounts = {
    cpmmCreatePoolFee: "3oE58BKVt8KuYkGxx8zBojugnymWmBiyafWgMrnb6eYy",
    legacyAMMV4CreatePoolFee: "9y8ENuuZ3b19quffx9hQvRVygG5ky6snHfRvGpuSfeJy"
}

export const raydiumMainnetPrograms = {
    launchLab: "LanMV9sAd7wArD4vJF12qddfnVhFxYSUg6eADduJ3uj",
    cpmm: "CPMMoo8L3F4NbTegBCKVNuxggL7H1ZpdTHKxQB5qKP1C",
    legacyAMM: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    stableSwapAMM: "5quBtoiQqxF9Jv6KYKCtB59NT3gtJD2Y65kdnB1UeV3h",
    clmm: "CAMMCzo5YL8w4VFF8KVHrK2226GUspo5VTaW7grrKgrWqK",
    burnAndEarn: "LocktWmn6K5twhz3y9w1dQERbmgSaRkfnTeTKbpoEwE",
    ammRouting: "routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS",
    staking: "EhhTKczWMGQt46ynNeRX1WfeagwwJd7ufHvCDjRxjo5Q",
    farmStaking: "9KEPoZmtHUrBbhWN1v1KWLMkkvwY6WLtAVUCPRtRjP4z",
    ecosystemFarm: "FarmqiPv5eAj3j1QMdMCMUGXqPUvmqztfHy8GQH6zzh6"
};

export const raydiumDevnetAPIV3BaseURL = "https://api-v3-devnet.raydium.io/" // https://api-v3-devnet.raydium.io/docs/
export const raydiumMainnetAPIV3BaseURL = "https://api-v3.raydium.io/" // doc: https://api-v3.raydium.io/docs/

export const raydiumCPMMPoolID = "4rGPudVbwsS5LrDt71fHGvaL4E6pKZJcVSzYnnXYDQCS"
