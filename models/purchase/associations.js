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
const Location = require('../../models/master/location');
const Invoice = require('../purchase/invoice');
const InvoiceItem = require('../purchase/invoiceItem');
const QuickGRN = require('../purchase/quickGRN');
const QuickGRNItem = require('../purchase/quickGRNItem');
const QuickInvoice = require('../purchase/quickInvoice');
const QuickInvoiceItem = require('../purchase/quickInvoiceItem');
const Return = require('../../models/distribution/Return');
const ReturnItem = require('../../models/distribution/ReturnItem');

const defineAssociations = () => {
    // PurchaseOrder -> OrderItem
    PurchaseOrder.hasMany(OrderItem, { foreignKey: 'poId', as: 'orderItems' });
    OrderItem.belongsTo(PurchaseOrder, { foreignKey: 'poId', as: 'purchaseOrder' });

    // PurchaseOrder -> StockStorage
    PurchaseOrder.hasMany(StockStorage, { foreignKey: 'poId', as: 'stockStorages' });
    StockStorage.belongsTo(PurchaseOrder, { foreignKey: 'poId', as: 'purchaseOrder' });

    // OrderItem -> Item
    OrderItem.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
    Item.hasMany(OrderItem, { foreignKey: 'itemId', as: 'orderItems' });

    // OrderItem -> GRNItem
    OrderItem.hasMany(GRNItem, { foreignKey: 'orderItemId', as: 'grnItems' });
    GRNItem.belongsTo(OrderItem, { foreignKey: 'orderItemId', as: 'orderItem' });

    // GRN -> PurchaseOrder
    GRN.belongsTo(PurchaseOrder, { foreignKey: 'poId', as: 'purchaseOrder' });

    // GRN -> GRNItem
    GRN.hasMany(GRNItem, { foreignKey: 'grnId', as: 'grnItems' });
    GRNItem.belongsTo(GRN, { foreignKey: 'grnId', as: 'grn' });

    // GRN -> StockStorage
    GRN.hasMany(StockStorage, { foreignKey: 'grnId', as: 'stockStorages' });
    StockStorage.belongsTo(GRN, { foreignKey: 'grnId', as: 'grn' });

    // StockStorage -> Item
    StockStorage.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
    Item.hasMany(StockStorage, { foreignKey: 'itemId', as: 'stockStorages' });

    // Invoice Associations
    PurchaseOrder.hasMany(Invoice, { foreignKey: 'poId', as: 'invoices' });
    Invoice.belongsTo(PurchaseOrder, { foreignKey: 'poId' });

    Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'items' });
    InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId' });

    OrderItem.hasOne(InvoiceItem, { foreignKey: 'orderItemId' });
    InvoiceItem.belongsTo(OrderItem, { foreignKey: 'orderItemId' });

    // QuickGRN -> QuickGRNItem
    QuickGRN.hasMany(QuickGRNItem, { foreignKey: 'qGRNId', as: 'items' });
    QuickGRNItem.belongsTo(QuickGRN, { foreignKey: 'qGRNId', as: 'quickGRN' });

    // QuickInvoice -> QuickInvoiceItem
    QuickInvoice.hasMany(QuickInvoiceItem, { foreignKey: 'qInvoiceId', as: 'quickInvoiceItems' });
    QuickInvoiceItem.belongsTo(QuickInvoice, { foreignKey: 'qInvoiceId' });

    // Distribution Module
    Distribution.hasMany(DistributionItem, { foreignKey: 'distributionId', as: 'items' });
    DistributionItem.belongsTo(Distribution, { foreignKey: 'distributionId', as: 'distribution' });
    DistributionItem.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
    Distribution.belongsTo(FinancialYear, { foreignKey: 'financialYearId', as: 'financialYear' });
    Distribution.belongsTo(Institute, { foreignKey: 'instituteId', as: 'institute' });
    Distribution.belongsTo(Location, { foreignKey: 'location',  as: 'locationData' });
    

    // Optional: Inverse relationships for Item
    Item.hasMany(DistributionItem, { foreignKey: 'itemId', as: 'distributionItems' });

    // Return Associations
    Return.hasMany(ReturnItem, { foreignKey: 'returnId', as: 'items' });
    ReturnItem.belongsTo(Return, { foreignKey: 'returnId', as: 'return' });
    ReturnItem.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
    Return.belongsTo(Distribution, { foreignKey: 'distributionId', as: 'distribution' });
    Return.belongsTo(FinancialYear, { foreignKey: 'financialYearId', as: 'financialYear' });
    Return.belongsTo(Institute, { foreignKey: 'instituteId', as: 'institute' });
};

module.exports = defineAssociations;
