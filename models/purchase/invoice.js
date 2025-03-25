const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

const Invoice = sequelize.define('invoice', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    invoiceNO: {
        type: Sequelize.STRING,
        allowNull: false
    },
    grnNOs: { // Changed from grnIds to grnNOs
        type: Sequelize.ARRAY(Sequelize.STRING), // Array of GRN numbers (strings)
        allowNull: true,
        defaultValue: []
    }
});

module.exports = Invoice;