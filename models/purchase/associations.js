const PurchaseOrder = require('./PurchaseOrder');
const OrderItem = require('./OrderItem');
const GRN = require('./GRN');
const GRNItem = require('./GRNItem');
const Item = require('../master/item');

const defineAssociations = () => {
    // PurchaseOrder associations
    PurchaseOrder.hasMany(OrderItem, { foreignKey: 'poId', as: 'orderItems' });
    PurchaseOrder.hasMany(GRN, { foreignKey: 'poId', as: 'grns' });

    // OrderItem associations
    OrderItem.belongsTo(PurchaseOrder, { foreignKey: 'poId', as: 'purchaseOrder' });
    OrderItem.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
    OrderItem.hasMany(GRNItem, { foreignKey: 'orderItemId', as: 'grnItems' });

    // GRN associations
    GRN.belongsTo(PurchaseOrder, { foreignKey: 'poId', as: 'purchaseOrder' });
    GRN.hasMany(GRNItem, { foreignKey: 'grnId', as: 'grnItems' });

    // GRNItem associations
    GRNItem.belongsTo(GRN, { foreignKey: 'grnId', as: 'grn' });
    GRNItem.belongsTo(OrderItem, { foreignKey: 'orderItemId', as: 'orderItem' });
};

module.exports = defineAssociations;