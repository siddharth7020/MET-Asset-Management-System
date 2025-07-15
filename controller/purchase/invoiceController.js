const Invoice = require('../../models/purchase/invoice');
const InvoiceItem = require('../../models/purchase/invoiceItem');
const PurchaseOrder = require('../../models/purchase/PurchaseOrder');
const OrderItem = require('../../models/purchase/OrderItem');
const { Sequelize, Op } = require('sequelize');
const path = require('path');
const fs = require('fs').promises;

// Ensure uploads directory exists
const ensureUploadsDir = async () => {
    const uploadsDir = path.join(__dirname, '../../uploads');
    try {
        await fs.mkdir(uploadsDir, { recursive: true });
    } catch (error) {
        console.error('Error creating uploads directory:', error);
    }
};

// Get all invoices
const getAllInvoices = async (req, res) => {
    try {
        const invoices = await Invoice.findAll({
            include: [
                { model: PurchaseOrder, as: 'PurchaseOrder' },
                {
                    model: InvoiceItem,
                    as: 'items',
                    include: [
                        {
                            model: OrderItem,
                            as: 'OrderItem',
                            include: [{ model: require('../../models/master/item'), as: 'item' }]
                        }
                    ]
                }
            ]
        });

        const allItemsTotalAmount = invoices.reduce((sum, invoice) => {
            return sum + invoice.items.reduce((itemSum, item) => itemSum + Number(item.totalAmount), 0);
        }, 0);

        res.json({ invoices, allItemsTotalAmount });
    } catch (error) {
        console.error('Error fetching invoices:', error, error.stack);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Create Invoice
const createInvoice = async (req, res) => {
    try {
        const { poId, invoiceDate = new Date(), paymentDetails, items } = req.body;

        // Parse items if sent as a JSON string
        const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

        // Validate required fields
        if (!poId || !parsedItems || !Array.isArray(parsedItems) || parsedItems.length === 0) {
            return res.status(400).json({ message: 'poId and items are required' });
        }

        // Handle file uploads
        let documentPaths = [];
        if (req.files && req.files.documents) {
            await ensureUploadsDir();
            const files = Array.isArray(req.files.documents) ? req.files.documents : [req.files.documents];
            documentPaths = await Promise.all(files.map(async (file, index) => {
                const fileName = `invoice_${Date.now()}_${index}${path.extname(file.name)}`;
                const filePath = path.join(__dirname, '../../uploads', fileName);
                await file.mv(filePath);
                return `/uploads/${fileName}`;
            }));
        }

        // Fetch PO details with OrderItems and Item
        const purchaseOrder = await PurchaseOrder.findByPk(poId, {
            include: [
                {
                    model: OrderItem,
                    as: 'orderItems',
                    include: [{ model: require('../../models/master/item'), as: 'item' }]
                }
            ]
        });

        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        // Generate invoiceNo in format IN-DDMMYY-XX (global incrementing sequence)
        const date = new Date(invoiceDate);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        const dateString = `${day}${month}${year}`;

        // Look for the last invoice, regardless of date
        const lastInvoice = await Invoice.findOne({
            where: {
                invoiceNo: {
                    [Op.like]: 'IN-%'
                }
            },
            order: [['invoiceNo', 'DESC']]
        });

        let sequence = 1;
        if (lastInvoice && lastInvoice.invoiceNo) {
            const parts = lastInvoice.invoiceNo.split('-');
            if (parts.length === 3) {
                const lastSeq = parseInt(parts[2], 10);
                if (!isNaN(lastSeq)) {
                    sequence = lastSeq + 1;
                } else {
                    console.warn(`Invalid invoiceNo format found: ${lastInvoice.invoiceNo}. Starting sequence at 1.`);
                }
            } else {
                console.warn(`Unexpected invoiceNo format: ${lastInvoice.invoiceNo}`);
            }
        }

        const invoiceNo = `IN-${dateString}-${String(sequence).padStart(2, '0')}`;


        // Calculate totals
        let subtotal = 0;
        let totalTax = 0;
        let allItemsTotalAmount = 0;

        const invoiceItems = parsedItems.map(item => {
            const orderItem = purchaseOrder.orderItems.find(oi => oi.id === item.orderItemId);
            if (!orderItem) {
                throw new Error(`Order Item ${item.orderItemId} not found`);
            }
            if (!orderItem.itemId) {
                throw new Error(`Item ID not found for Order Item ${item.orderItemId}`);
            }

            // Calculate subtotal before discount
            const itemSubtotal = orderItem.quantity * orderItem.rate;

            // Calculate discount amount (discount as percentage)
            const discountAmount = (itemSubtotal * (orderItem.discount || 0)) / 100;

            // Base amount after discount
            const amount = itemSubtotal - discountAmount;

            // Tax percentage (e.g., 18 for 18%)
            const taxPercentage = item.taxPercentage || 0;

            // Tax amount
            const taxAmount = (amount * taxPercentage) / 100;

            // Total amount
            const totalAmount = amount + taxAmount;

            subtotal += amount;
            totalTax += taxAmount;
            allItemsTotalAmount += totalAmount;

            return {
                invoiceId: null, // Set after invoice creation
                orderItemId: item.orderItemId,
                itemId: orderItem.itemId,
                unitId: orderItem.unitId,
                quantity: orderItem.quantity,
                rate: orderItem.rate,
                discount: orderItem.discount || 0,
                taxPercentage,
                taxAmount,
                amount: amount.toFixed(2),
                totalAmount
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
            paymentDetails,
            document: documentPaths.length > 0 ? documentPaths : null
        });

        // Update invoiceItems with invoiceId and create them
        const invoiceItemData = invoiceItems.map(item => ({
            ...item,
            invoiceId: invoice.id
        }));
        await InvoiceItem.bulkCreate(invoiceItemData);

        // Fetch complete invoice with items
        const createdInvoice = await Invoice.findByPk(invoice.id, {
            include: [
                {
                    model: InvoiceItem,
                    as: 'items',
                    include: [
                        {
                            model: OrderItem,
                            as: 'OrderItem',
                            include: [{ model: require('../../models/master/item'), as: 'item' }]
                        }
                    ]
                }
            ]
        });

        // Add allItemsTotalAmount to response
        const response = {
            ...createdInvoice.toJSON(),
            allItemsTotalAmount
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Error creating invoice:', error, error.stack);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Get Invoice by ID
const getInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findByPk(req.params.id, {
            include: [
                { model: PurchaseOrder, as: 'PurchaseOrder' },
                {
                    model: InvoiceItem,
                    as: 'items',
                    include: [
                        {
                            model: OrderItem,
                            as: 'OrderItem',
                            include: [{ model: require('../../models/master/item'), as: 'item' }]
                        }
                    ]
                }
            ]
        });

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        const allItemsTotalAmount = invoice.items.reduce((sum, item) => sum + Number(item.totalAmount), 0);

        const response = {
            ...invoice.toJSON(),
            allItemsTotalAmount
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching invoice:', error, error.stack);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Update Invoice
const updateInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const { invoiceNo, invoiceDate, paymentDetails, paymentDate, items } = req.body;

        // Parse items if sent as a JSON string
        const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

        // Validate required fields
        if (!parsedItems || !Array.isArray(parsedItems) || parsedItems.length === 0) {
            return res.status(400).json({ message: 'items are required' });
        }

        // Find existing invoice
        const invoice = await Invoice.findByPk(id, {
            include: [{ model: InvoiceItem, as: 'items' }]
        });

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Handle file uploads
        let documentPaths = invoice.document || [];
        if (req.files && req.files.documents) {
            await ensureUploadsDir();
            const files = Array.isArray(req.files.documents) ? req.files.documents : [req.files.documents];
            const newPaths = await Promise.all(files.map(async (file, index) => {
                const fileName = `invoice_${Date.now()}_${index}${path.extname(file.name)}`;
                const filePath = path.join(__dirname, '../../Uploads', fileName);
                await file.mv(filePath);
                return `/uploads/${fileName}`;
            }));
            documentPaths = [...documentPaths, ...newPaths];
        }

        // Fetch PO details
        const purchaseOrder = await PurchaseOrder.findByPk(invoice.poId, {
            include: [
                {
                    model: OrderItem,
                    as: 'orderItems',
                    include: [{ model: require('../../models/master/item'), as: 'item' }]
                }
            ]
        });

        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        // Calculate totals
        let subtotal = 0;
        let totalTax = 0;
        let allItemsTotalAmount = 0;

        const updatedInvoiceItems = parsedItems.map(item => {
            const orderItem = purchaseOrder.orderItems.find(oi => oi.id === item.orderItemId);
            if (!orderItem) {
                throw new Error(`Order Item ${item.orderItemId} not found`);
            }
            if (!orderItem.itemId) {
                throw new Error(`Item ID not found for Order Item ${item.orderItemId}`);
            }

            // Calculate subtotal before discount
            const itemSubtotal = orderItem.quantity * orderItem.rate;

            // Calculate discount amount (discount as percentage)
            const discountAmount = (itemSubtotal * (orderItem.discount || 0)) / 100;

            // Base amount after discount
            const amount = itemSubtotal - discountAmount;

            // Tax percentage (e.g., 18 for 18%)
            const taxPercentage = item.taxPercentage || 0;

            // Tax amount
            const taxAmount = (amount * taxPercentage) / 100;

            // Total amount
            const totalAmount = amount + taxAmount;

            subtotal += amount;
            totalTax += taxAmount;
            allItemsTotalAmount += totalAmount;

            return {
                id: item.id,
                invoiceId: invoice.id,
                orderItemId: item.orderItemId,
                itemId: orderItem.itemId,
                unitId: orderItem.unitId,
                quantity: orderItem.quantity,
                rate: orderItem.rate,
                discount: orderItem.discount || 0,
                taxPercentage,
                taxAmount,
                amount: amount.toFixed(2),
                totalAmount
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
            paymentDate: paymentDate || invoice.paymentDate,
            document: documentPaths.length > 0 ? documentPaths : invoice.document
        });

        // Update or create invoice items
        for (const item of updatedInvoiceItems) {
            if (item.id) {
                // Update existing item
                await InvoiceItem.update(
                    {
                        orderItemId: item.orderItemId,
                        itemId: item.itemId,
                        quantity: item.quantity,
                        rate: item.rate,
                        discount: item.discount,
                        taxPercentage: item.taxPercentage,
                        taxAmount: item.taxAmount,
                        amount: item.amount,
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
            include: [
                {
                    model: InvoiceItem,
                    as: 'items',
                    include: [
                        {
                            model: OrderItem,
                            as: 'OrderItem',
                            include: [{ model: require('../../models/master/item'), as: 'item' }]
                        }
                    ]
                }
            ]
        });

        // Prepare response
        const response = {
            ...updatedInvoice.toJSON(),
            allItemsTotalAmount
        };

        res.json(response);
    } catch (error) {
        console.error('Error updating invoice:', error, error.stack);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Get PO details for Invoice creation
const getPODetailsForInvoice = async (req, res) => {
    try {
        const poId = req.params.poId;
        const purchaseOrder = await PurchaseOrder.findByPk(poId, {
            include: [
                {
                    model: OrderItem,
                    as: 'orderItems',
                    include: [{ model: require('../../models/master/item'), as: 'item' }]
                }
            ]
        });

        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        res.json(purchaseOrder);
    } catch (error) {
        console.error('Error fetching PO details:', error, error.stack);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

module.exports = { getAllInvoices, createInvoice, getInvoice, updateInvoice, getPODetailsForInvoice };