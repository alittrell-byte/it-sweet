'use strict';

const { v4: uuidv4 } = require('uuid');

// Data migration: Asset.vendor was a free-text string with no reuse across assets - this
// backfills one Vendor row per distinct existing value and repoints each asset's new
// vendor_id at it, so the follow-up migration can drop the old free-text column without
// losing any existing data. Known limitation (documented, not fixed here): inconsistently
// typed names ("Dell" vs "Dell Inc") become separate vendor rows - no merge tool exists yet.
// Idempotent - safe to run more than once (skips vendors/links that already exist).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [distinctVendors] = await queryInterface.sequelize.query(
      "SELECT DISTINCT vendor FROM assets WHERE vendor IS NOT NULL AND vendor <> ''"
    );
    const now = new Date();

    for (const { vendor: vendorName } of distinctVendors) {
      const [existingVendor] = await queryInterface.sequelize.query('SELECT id FROM vendors WHERE name = :vendorName', {
        replacements: { vendorName },
      });

      let vendorId;
      if (existingVendor.length > 0) {
        vendorId = existingVendor[0].id;
      } else {
        // UUID generated in JS (not DB-side gen_random_uuid()/UUID()) so this works identically
        // on Postgres and MySQL.
        vendorId = uuidv4();
        await queryInterface.bulkInsert('vendors', [{ id: vendorId, name: vendorName, created_at: now, updated_at: now }]);
      }

      await queryInterface.sequelize.query('UPDATE assets SET vendor_id = :vendorId WHERE vendor = :vendorName', {
        replacements: { vendorId, vendorName },
      });
    }
  },
  async down() {
    // Not meaningfully reversible - the old free-text column is dropped by the next migration.
  },
};
