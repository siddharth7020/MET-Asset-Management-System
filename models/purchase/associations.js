const PurchaseOrder = require('./PurchaseOrder');
const OrderItem = require('./OrderItem');
const GRN = require('./GRN');
const GRNItem = require('./GRNItem');
const Item = require('../master/item');
const StockStorage = require('../distribution/stockStorage');
const Distribution = require('../distribution/Distribution');
const DistributionItem = require('../../models/distribution/DistributionItem');
const FinancialYear = require('../../models/master/financialYear');
const Institute = require('../../models/master/institute');

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

    PurchaseOrder.hasMany(StockStorage, { foreignKey: 'poId', as: 'stockStorages' });
    GRN.hasMany(StockStorage, { foreignKey: 'grnId', as: 'stockStorages' });
    Item.hasMany(StockStorage, { foreignKey: 'itemId', as: 'stockStorages' });
    StockStorage.belongsTo(PurchaseOrder, { foreignKey: 'poId', as: 'purchaseOrder' });
    StockStorage.belongsTo(GRN, { foreignKey: 'grnId', as: 'grn' });
    StockStorage.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });

    // New associations for Distribution
    Distribution.hasMany(DistributionItem, { foreignKey: 'distributionId', as: 'item' });
    DistributionItem.belongsTo(Distribution, { foreignKey: 'distributionId', as: 'distribution' });
    DistributionItem.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
    Distribution.belongsTo(FinancialYear, { foreignKey: 'financialYearId', as: 'financialYear' });
    Distribution.belongsTo(Institute, { foreignKey: 'instituteId', as: 'institute' });

};

module.exports = defineAssociations;