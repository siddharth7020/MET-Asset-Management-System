const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const StockStorage = sequelize.define('StockStorage', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    poId: {
        type: DataTypes.INTEGER,
        allowNull: true // Make nullable for QuickGRN
    },
    grnId: {
        type: DataTypes.INTEGER,
        allowNull: true // Make nullable for QuickGRN
    },
    qGRNId: {
        type: DataTypes.INTEGER,
        allowNull: true // Make nullable for normal GRN
    },
    itemId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 0 }
    },
    remark: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'stock_storage',
    timestamps: true
});

module.exports = StockStorage;