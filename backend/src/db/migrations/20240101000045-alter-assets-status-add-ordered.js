'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Sequelize's changeColumn does NOT actually alter a Postgres enum TYPE when only adding a
    // value - confirmed the hard way earlier this session (see
    // 20240101000026-alter-tickets-add-p1-columns.js): the migration reports success but the
    // underlying type is left unchanged, and inserting the new value fails at runtime. Postgres
    // needs an explicit ALTER TYPE ... ADD VALUE; MySQL's ENUM is inline on the column, so
    // changeColumn works fine there.
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query("ALTER TYPE \"enum_assets_status\" ADD VALUE IF NOT EXISTS 'ordered'");
    } else {
      await queryInterface.changeColumn('assets', 'status', {
        type: Sequelize.ENUM('available', 'in_use', 'retired', 'lost', 'under_repair', 'ordered'),
        allowNull: false,
        defaultValue: 'available',
      });
    }
  },
  async down(queryInterface, Sequelize) {
    // No supported "remove enum value" operation on Postgres short of recreating the type -
    // left as a no-op there (purely additive value, no down-path). MySQL's inline enum can
    // shrink safely as long as no existing row uses the removed value.
    if (queryInterface.sequelize.getDialect() !== 'postgres') {
      await queryInterface.changeColumn('assets', 'status', {
        type: Sequelize.ENUM('available', 'in_use', 'retired', 'lost', 'under_repair'),
        allowNull: false,
        defaultValue: 'available',
      });
    }
  },
};
