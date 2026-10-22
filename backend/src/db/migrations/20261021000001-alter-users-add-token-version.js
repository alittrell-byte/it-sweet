'use strict';

// Refresh tokens carry the user's token_version; bumping it (logout, password change or
// reset) invalidates every refresh token issued before, so a stolen one stops working.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'token_version', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'token_version');
  },
};
