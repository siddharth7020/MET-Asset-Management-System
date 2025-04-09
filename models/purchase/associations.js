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
const Invoice = require('../purchase/invoice');
const InvoiceItem = require('../purchase/invoiceItem');
const QuickGRN = require('../purchase/quickGRN');
const QuickGRNItem = require('../purchase/quickGRNItem');
const QuickInvoice = require('../purchase/quickInvoice');
const QuickInvoiceItem = require('../purchase/quickInvoiceItem');

const defineAssociations = () => {
    // PurchaseOrder Associations
    PurchaseOrder.hasMany(OrderItem, { foreignKey: 'poId', as: 'orderItems' });
    PurchaseOrder.hasMany(StockStorage, { foreignKey: 'poId', as: 'stockStorages' });

    // OrderItem Associations
    OrderItem.belongsTo(PurchaseOrder, { foreignKey: 'poId', as: 'purchaseOrder' });
    OrderItem.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
    OrderItem.hasMany(GRNItem, { foreignKey: 'orderItemId', as: 'grnItems' });

    // GRN Associations
    GRN.belongsTo(PurchaseOrder, { foreignKey: 'poId', as: 'purchaseOrder' });
    GRN.hasMany(GRNItem, { foreignKey: 'grnId', as: 'grnItems' });
    GRN.hasMany(StockStorage, { foreignKey: 'grnId', as: 'stockStorages' });

    // GRNItem Associations
    GRNItem.belongsTo(GRN, { foreignKey: 'grnId', as: 'grn' });
    GRNItem.belongsTo(OrderItem, { foreignKey: 'orderItemId', as: 'orderItem' });

    // QuickGRN -> QuickGRNItem
    // Associations
    QuickGRN.hasMany(QuickGRNItem, { foreignKey: 'qGRNId', as: 'items' });
    QuickGRNItem.belongsTo(QuickGRN, { foreignKey: 'qGRNId', as: 'quickGRN' });



    //Quick GRN Item Associations
    // QuickGRNItem.belongsTo(QuickGRN, { foreignKey: 'qGRNId', as: 'quickGRN' });
    // QuickGRNItem.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
    // QuickGRNItem.belongsTo(StockStorage, { foreignKey: 'stockStorageId', as: 'stockStorage' });


    //invoice Associations
    PurchaseOrder.hasMany(Invoice, { foreignKey: 'poId', as: 'invoices' });
    Invoice.belongsTo(PurchaseOrder, { foreignKey: 'poId' });

    Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'items' });
    InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId' });

    OrderItem.hasOne(InvoiceItem, { foreignKey: 'orderItemId' });
    InvoiceItem.belongsTo(OrderItem, { foreignKey: 'orderItemId' });
    //end InvoiceItem Associations

    // QuickInvoice Associations
    QuickInvoice.hasMany(QuickInvoiceItem, { foreignKey: 'quickInvoiceid', as: 'quickInvoiceItems' });
    QuickInvoiceItem.belongsTo(QuickInvoice, { foreignKey: 'quickInvoiceid' });
    //End QuickInvoice Associations


    // StockStorage Associations
    StockStorage.belongsTo(PurchaseOrder, { foreignKey: 'poId', as: 'purchaseOrder' });
    StockStorage.belongsTo(GRN, { foreignKey: 'grnId', as: 'grn' });
    StockStorage.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
    Item.hasMany(StockStorage, { foreignKey: 'itemId', as: 'stockStorages' });

    // Distribution Module Associations
    Distribution.hasMany(DistributionItem, { foreignKey: 'distributionId', as: 'items' });
    DistributionItem.belongsTo(Distribution, { foreignKey: 'distributionId', as: 'distribution' });
    DistributionItem.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
    Distribution.belongsTo(FinancialYear, { foreignKey: 'financialYearId', as: 'financialYear' });
    Distribution.belongsTo(Institute, { foreignKey: 'instituteId', as: 'institute' });
}

module.exports = defineAssociations;
