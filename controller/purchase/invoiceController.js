const Invoice = require('../../models/purchase/invoice'); // Adjust the path as necessary
const InvoiceItem = require('../../models/purchase/invoiceItem'); // Adjust the path as necessary
const PurchaseOrder = require('../../models/purchase/PurchaseOrder'); // Adjust the path as necessary
const OrderItem = require('../../models/purchase/OrderItem'); // Adjust the path as necessary
const { Sequelize } = require('sequelize');


//get all invoices
const getAllInvoices = async (req, res) => {
    try {
        const invoices = await Invoice.findAll({
            include: [
                { model: PurchaseOrder, as: 'PurchaseOrder' },
                { model: InvoiceItem, as: 'items', include: [{ model: OrderItem, as: 'OrderItem' }] }
            ]
        });

        const allItemsTotalAmount = invoices.reduce((sum, invoice) => {
            return sum + invoice.items.reduce((itemSum, item) => itemSum + Number(item.totalAmount), 0);
        }, 0);

        res.json({ invoices, allItemsTotalAmount });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}
// Create Invoice
const createInvoice = async (req, res) => {
    try {
        const { poId, invoiceNo, invoiceDate, paymentDetails, items } = req.body;

        // Fetch PO details
        const purchaseOrder = await PurchaseOrder.findByPk(poId, {
            include: [{ model: OrderItem, as: 'orderItems' }]
        });

        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        // Calculate totals
        let subtotal = 0;
        let totalTax = 0;
        let allItemsTotalAmount = 0;

        const invoiceItems = items.map(item => {
            const orderItem = purchaseOrder.orderItems.find(oi => oi.id === item.orderItemId);
            if (!orderItem) throw new Error(`Order Item ${item.orderItemId} not found`);
            
            // Base amount before tax (quantity * rate - discount)
            const amount = orderItem.quantity * orderItem.rate - (orderItem.discount || 0);
            
            // Tax percentage (e.g., 18 for 18%)
            const taxPercentage = item.taxPercentage || 0;
            
            // Tax amount = (base amount * tax percentage) / 100
            const taxAmount = (amount * taxPercentage) / 100;
            
            // Total amount = base amount + tax amount
            const totalAmount = amount + taxAmount;
            
            subtotal += amount;
            totalTax += taxAmount;
            allItemsTotalAmount += totalAmount;

            return {
                invoiceId: null, // Will be set after invoice creation
                orderItemId: item.orderItemId,
                quantity: orderItem.quantity,
                rate: orderItem.rate,
                discount: orderItem.discount,
                taxPercentage: taxPercentage, // Store 18
                taxAmount: taxAmount,        // Store computed tax (e.g., 18% of amount)
                totalAmount: totalAmount     // Store amount + tax
            };
        });

        // Create Invoice
        const invoice = await Invoice.create({
            invoiceNo,
            poId,
            invoiceDate,
            subtotal,
            totalTax,
            invoiceAmount: subtotal + totalTax,
            paymentDetails
        });

        // Update invoiceItems with invoiceId and create them
        const invoiceItemData = invoiceItems.map(item => ({
            ...item,
            invoiceId: invoice.id
        }));
        await InvoiceItem.bulkCreate(invoiceItemData);

        // Fetch complete invoice with all items total
        const createdInvoice = await Invoice.findByPk(invoice.id, {
            include: [{ model: InvoiceItem, as: 'items' }]
        });

        // Add allItemsTotalAmount to response
        const response = {
            ...createdInvoice.toJSON(),
            allItemsTotalAmount: allItemsTotalAmount
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Get Invoice by ID (unchanged from previous)
const getInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findByPk(req.params.id, {
            include: [
                { model: PurchaseOrder, as: 'PurchaseOrder' },
                { model: InvoiceItem, as: 'items', include: [{ model: OrderItem, as: 'OrderItem' }] }
            ]
        });

        if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

        const allItemsTotalAmount = invoice.items.reduce((sum, item) => sum + Number(item.totalAmount), 0);

        const response = {
            ...invoice.toJSON(),
            allItemsTotalAmount: allItemsTotalAmount
        };

        res.json(response);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Update Invoice
const updateInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const { invoiceNo, invoiceDate, paymentDetails, paymentDate, items } = req.body;

        // Find existing invoice
        const invoice = await Invoice.findByPk(id, {
            include: [{ model: InvoiceItem, as: 'items' }]
        });

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Fetch PO details
        const purchaseOrder = await PurchaseOrder.findByPk(invoice.poId, {
            include: [{ model: OrderItem, as: 'orderItems' }]
        });

        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        // Calculate totals
        let subtotal = 0;
        let totalTax = 0;
        let allItemsTotalAmount = 0;

        const updatedInvoiceItems = items.map(item => {
            const orderItem = purchaseOrder.orderItems.find(oi => oi.id === item.orderItemId);
            if (!orderItem) throw new Error(`Order Item ${item.orderItemId} not found`);

            // Base amount before tax (quantity * rate - discount)
            const amount = orderItem.quantity * orderItem.rate - (orderItem.discount || 0);

            // Tax percentage (e.g., 18 for 18%)
            const taxPercentage = item.taxPercentage || 0;

            // Tax amount = (base amount * tax percentage) / 100
            const taxAmount = (amount * taxPercentage) / 100;

            // Total amount = base amount + tax amount
            const totalAmount = amount + taxAmount;

            subtotal += amount;
            totalTax += taxAmount;
            allItemsTotalAmount += totalAmount;

            return {
                id: item.id, // For existing items
                invoiceId: invoice.id,
                orderItemId: item.orderItemId,
                quantity: orderItem.quantity,
                rate: orderItem.rate,
                discount: orderItem.discount,
                taxPercentage: taxPercentage,
                taxAmount: taxAmount,
                totalAmount: totalAmount
            };
        });

        // Update Invoice
        await invoice.update({
            invoiceNo: invoiceNo || invoice.invoiceNo,
            invoiceDate: invoiceDate || invoice.invoiceDate,
            subtotal,
            totalTax,
            invoiceAmount: subtotal + totalTax,
            paymentDetails: paymentDetails || invoice.paymentDetails,
            paymentDate: paymentDate || invoice.paymentDate
        });

        // Update or create invoice items
        for (const item of updatedInvoiceItems) {
            if (item.id) {
                // Update existing item
                await InvoiceItem.update(
                    {
                        orderItemId: item.orderItemId,
                        quantity: item.quantity,
                        rate: item.rate,
                        discount: item.discount,
                        taxPercentage: item.taxPercentage,
                        taxAmount: item.taxAmount,
                        totalAmount: item.totalAmount
                    },
                    { where: { id: item.id, invoiceId: invoice.id } }
                );
            } else {
                // Create new item
                await InvoiceItem.create({
                    ...item,
                    invoiceId: invoice.id
                });
            }
        }

        // Delete items that are no longer in the updated items list
        const itemIds = updatedInvoiceItems.filter(item => item.id).map(item => item.id);
        await InvoiceItem.destroy({
            where: {
                invoiceId: invoice.id,
                id: { [Sequelize.Op.notIn]: itemIds }
            }
        });

        // Fetch updated invoice
        const updatedInvoice = await Invoice.findByPk(id, {
            include: [{ model: InvoiceItem, as: 'items' }]
        });

        // Prepare response
        const response = {
            ...updatedInvoice.toJSON(),
            allItemsTotalAmount: allItemsTotalAmount
        };

        res.json(response);
    } catch (error) {
        console.error('Error updating invoice:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Get PO details for Invoice creation (unchanged)
const getPODetailsForInvoice = async (req, res) => {
    try {
        const poId = req.params.poId;
        const purchaseOrder = await PurchaseOrder.findByPk(poId, {
            include: [{ model: OrderItem, as: 'orderItems' }]
        });
        
        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }
        
        res.json(purchaseOrder);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

module.exports = {getAllInvoices, createInvoice, getInvoice, updateInvoice, getPODetailsForInvoice };