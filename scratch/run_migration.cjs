const { readFileSync } = require('fs');
const { Client } = require('pg');

async function main() {
  const sql = readFileSync('c:/Web/shopofbow/supabase/migrations/0032_coupon_system.sql', 'utf8');
  console.log('Migration SQL length:', sql.length);
}

main();
