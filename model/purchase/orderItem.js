const Sequelize = require('sequelize');
const sequelize = require('../../config/database');

const OrderItem = sequelize.define('OrderItem', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    poId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'purchase_order', // Use table name as string
            key: 'poId'
        }
    },
    itemId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'item', // Use table name as string
            key: 'itemId'
        }
    },
    quantity: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    rate: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
    },
    amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
    },
    discount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    tax1: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    tax2: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    totalTax: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
    },
    totalAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
    },
    acceptedQuantity: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    rejectedQuantity: {
        type: Sequelize.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'order_item'
});

// Associations will be defined in models/index.js
OrderItem.associate = function (models) {
    OrderItem.belongsTo(models.PurchaseOrder, { foreignKey: 'poId', as: 'purchaseOrder' });
    OrderItem.belongsTo(models.Item, { foreignKey: 'itemId', as: 'item' });
};

module.exports = OrderItem;