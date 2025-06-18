const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const QuickInvoiceItem = sequelize.define('quickInvoiceItem', {
    qInvoiceItemId: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    qInvoiceId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    qGRNId: { // Add this field to store the parent GRN ID
        type: DataTypes.INTEGER,
        allowNull: false
    },
    qGRNItemid: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    unitId: {
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
        allowNull: true
    },
    taxPercentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false
    },
    taxAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    }
}, {
    tableName: 'quick_invoice_items',
    timestamps: true
});

module.exports = QuickInvoiceItem;