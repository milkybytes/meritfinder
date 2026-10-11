// What the database keeps: a market not updated for this long says nothing about today's prices, so older stations are not stored and no search can
// ask for older markets.
export const MAX_MARKET_AGE_DAYS = 365;
