const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

const PurchaseOrder = sequelize.define('PurchaseOrder', {
    poId: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    poDate: {
        type: Sequelize.DATE,
        allowNull: false
    },
    poNo: {
        type: Sequelize.STRING,
        allowNull: false
    },
    instituteId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'institute', // Use table name as string
            key: 'instituteId'
        }
    },
    financialYearId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'financialYear', // Use table name as string
            key: 'financialYearId'
        }
    },
    vendorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'vendor', // Use table name as string
            key: 'vendorId'
        }
    },
    document: {
        type: Sequelize.STRING,
        allowNull: false
    },
    requestedBy: {
        type: Sequelize.STRING,
        allowNull: false
    },
    remark: {
        type: Sequelize.STRING,
        allowNull: false
    },
    assetQuantity: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    assetData: {
        type: Sequelize.JSON,
        allowNull: true
    }
}, {
    tableName: 'purchase_order'
});

// Associations will be defined in models/index.js
PurchaseOrder.associate = function (models) {
    PurchaseOrder.belongsTo(models.Institute, { foreignKey: 'instituteId' });
    PurchaseOrder.belongsTo(models.FinancialYear, { foreignKey: 'financialYearId' });
    PurchaseOrder.belongsTo(models.Vendor, { foreignKey: 'vendorId' });
    PurchaseOrder.hasMany(models.OrderItem, { foreignKey: 'poId', as: 'orderItems' });
};

module.exports = PurchaseOrder;