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
    // PurchaseOrder is linked to multiple OrderItems (One-to-Many)
    PurchaseOrder.hasMany(OrderItem, { foreignKey: 'poId', as: 'orderItems' });

    // OrderItem is linked to an Item (Many-to-One)
    OrderItem.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });

    // An OrderItem can have multiple GRNItems (One-to-Many)
    OrderItem.hasMany(GRNItem, { foreignKey: 'orderItemId', as: 'grnItems' });

    // GRN (Goods Received Note) is linked to a specific PurchaseOrder (Many-to-One)
    GRN.belongsTo(PurchaseOrder, { foreignKey: 'poId', as: 'purchaseOrder' });

    // A GRN can have multiple GRNItems (One-to-Many)
    GRN.hasMany(GRNItem, { foreignKey: 'grnId', as: 'grnItems' });

    // GRNItem belongs to a specific GRN (Many-to-One)
    GRNItem.belongsTo(GRN, { foreignKey: 'grnId', as: 'grn' });

    // GRNItem belongs to a specific OrderItem (Many-to-One)
    GRNItem.belongsTo(OrderItem, { foreignKey: 'orderItemId', as: 'orderItem' });

    // Many-to-Many relationship between GRN and OrderItem via GRNItem
    GRN.belongsToMany(OrderItem, { through: GRNItem, as: 'orderItems' });

    // StockStorage associations
    // PurchaseOrder can have multiple StockStorage entries
    PurchaseOrder.hasMany(StockStorage, { foreignKey: 'poId', as: 'stockStorages' });

    // GRN can have multiple StockStorage entries
    GRN.hasMany(StockStorage, { foreignKey: 'grnId', as: 'stockStorages' });

    // Item can have multiple StockStorage entries
    Item.hasMany(StockStorage, { foreignKey: 'itemId', as: 'stockStorages' });

    // StockStorage belongs to PurchaseOrder
    StockStorage.belongsTo(PurchaseOrder, { foreignKey: 'poId', as: 'purchaseOrder' });

    // StockStorage belongs to GRN
    StockStorage.belongsTo(GRN, { foreignKey: 'grnId', as: 'grn' });

    // StockStorage belongs to Item
    StockStorage.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });

    // Distribution module associations
    // Distribution can have multiple DistributionItems (One-to-Many)
    Distribution.hasMany(DistributionItem, { foreignKey: 'distributionId', as: 'items' });

    // Each DistributionItem belongs to a Distribution (Many-to-One)
    DistributionItem.belongsTo(Distribution, { foreignKey: 'distributionId', as: 'distribution' });

    // DistributionItem is linked to an Item (Many-to-One)
    DistributionItem.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });

    // Distribution belongs to a FinancialYear (Many-to-One)
    Distribution.belongsTo(FinancialYear, { foreignKey: 'financialYearId', as: 'financialYear' });

    // Distribution belongs to an Institute (Many-to-One)
    Distribution.belongsTo(Institute, { foreignKey: 'instituteId', as: 'institute' });
}


module.exports = defineAssociations;