// invoiceItem.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const InvoiceItem = sequelize.define('InvoiceItem', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    invoiceId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    orderItemId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    rate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    discount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    taxPercentage: {
        type: DataTypes.DECIMAL(5, 2), // e.g., 12.50 for 12.5%
        defaultValue: 0.00,
        validate: { min: 0, max: 100 } // Restrict to valid percentage range
    },
    taxAmount: {
        type: DataTypes.DECIMAL(10, 2), // Computed tax amount
        defaultValue: 0.00
    },
    totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    }
}, {
    tableName: 'invoice_items',
    timestamps: true
});

module.exports = InvoiceItem;