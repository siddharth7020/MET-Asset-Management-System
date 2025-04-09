const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const QuickInvoice = sequelize.define('quickInvoice', {
    qInvoiceId: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    qInvoiceNo: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    qInvoiceDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    qGRNIds: {
        type: DataTypes.ARRAY(DataTypes.INTEGER), // Store selected QuickGRN IDs
        allowNull: false
    },
    totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    remark: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'quick_invoices',
    timestamps: true
});

module.exports = QuickInvoice;
