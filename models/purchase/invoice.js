const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const GRN = require('../purchase/GRN'); // Import GRN model

const Invoice = sequelize.define('Invoice', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    invoiceNo: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    grnNos: {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
        allowNull: false,
        defaultValue: []
    },
    invoiceDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    invoiceAmount: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    paidAmount: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    paymentDetails: {
        type: DataTypes.TEXT, // Use TEXT for detailed payment info (e.g., JSON string or description)
        allowNull: true
    },
    paymentDate: {
        type: DataTypes.DATE,
        allowNull: true // Nullable since payment might not be made yet
    }
}, {
    tableName: 'invoices',
    timestamps: true
});

// Relationships
Invoice.belongsToMany(GRN, {
    through: 'InvoiceGRNs',
    foreignKey: 'invoiceId',
    otherKey: 'grnId'
});

GRN.belongsToMany(Invoice, {
    through: 'InvoiceGRNs',
    foreignKey: 'grnId',
    otherKey: 'invoiceId'
});

module.exports = Invoice;