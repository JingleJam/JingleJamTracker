DROP TABLE IF EXISTS TotalsOverTime;

CREATE TABLE IF NOT EXISTS TotalsOverTime (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME UNIQUE NOT NULL,
    year INT NOT NULL,
    amountDollars DECIMAL(10,2) NOT NULL,
    amountPounds DECIMAL(10,2) NOT NULL
);
CREATE INDEX idx_timestamp ON TotalsOverTime(timestamp);