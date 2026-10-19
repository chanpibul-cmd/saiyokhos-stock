DELETE FROM buys;
DELETE FROM pays;
DELETE FROM sqlite_sequence WHERE name IN ('buys', 'pays');
