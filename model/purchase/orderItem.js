const Sequelize = require('sequelize');
const sequelize = require('../../config/database');
const PurchaseOrder = require('./purchaseOrder');

const OrderItem = sequelize.define('order_item', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    poId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'purchase_order', // References PurchaseOrder table
            key: 'poId',
        },
    },
    itemId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'items', // Assuming table name is 'items'
            key: 'id',
        },
    },
    quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    rate: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
    },
    amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
    },
    discount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00,
    },
    tax1: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00,
    },
    tax2: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00,
    },
    totalTax: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
    },
    totalAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
    },
});

OrderItem.associate = function () {
    OrderItem.belongsTo(PurchaseOrder, { foreignKey: 'poId' });
};

module.exports = OrderItem;