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
    OtherAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00
    },
    taxAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00
    },
    discountedAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00
    },
    totalAmountWithTax: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    document: {
        type: DataTypes.STRING(1000), // Stores JSON array of file paths
        allowNull: true,
        get() {
            const value = this.getDataValue('document');
            return value ? JSON.parse(value) : [];
        },
        set(value) {
            this.setDataValue('document', value ? JSON.stringify(value) : null);
        }
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
