// Invoice Model (invoice.js)
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Invoice = sequelize.define('Invoice', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    invoiceNo: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    poId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    invoiceDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    subtotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    totalTax: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    invoiceAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    paymentDetails: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    paymentDate: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'invoices',
    timestamps: true
});

module.exports = Invoice;