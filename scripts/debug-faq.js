const Database = require('../service/database/database');
const config = require('../config/config');

(async () => {
  const db = new Database(config.database);
  try {
    await db.connect();
    const { rows } = await db.query(
      "SELECT id,title,language_code,rubrique FROM faq_search_view ORDER BY id ASC LIMIT 20"
    );
    console.log('FAQ rows:', rows.length);
    rows.forEach(row => {
      console.log(`[${row.id}] ${row.language_code}/${row.rubrique} -> ${row.title}`);
    });
  } catch (error) {
    console.error('Failed to inspect FAQ data:', error);
  } finally {
    await db.close();
  }
})();

