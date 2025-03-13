const Sequelize = require('sequelize');
const sequelize = require('../../config/database');
const Institute = require('../../model/master/institute');
const FinancialYear = require('../../model/master/financialYear');
const Vendor = require('../../model/master/vendor');

const PurchaseOrder = sequelize.define('purchase_order', {
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
            model: Institute,
            key: 'instituteId'
        }
    },
    financialYearId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: FinancialYear,
            key: 'financialYearId'
        }
    },
    vendorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: Vendor,
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
        type: Sequelize.VIRTUAL,
        get() {
            return this.getOrderItems()
                .then(orderItems => new Set(orderItems.map(oi => oi.itemId)).size);
        },
    },
});

PurchaseOrder.associate = function () {
    PurchaseOrder.belongsTo(Institute, { foreignKey: 'instituteId' });
    PurchaseOrder.belongsTo(FinancialYear, { foreignKey: 'financialYearId' });
    PurchaseOrder.belongsTo(Vendor, { foreignKey: 'vendorId' });
};

module.exports = PurchaseOrder;