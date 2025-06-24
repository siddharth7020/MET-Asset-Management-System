const QuickInvoiceItem = require('../../models/purchase/quickInvoiceItem');
const QuickGRNItem = require('../../models/purchase/quickGRNItem');
const QuickInvoice = require('../../models/purchase/quickInvoice');
const QuickGRN = require('../../models/purchase/quickGRN');
const { Sequelize } = require('sequelize');
const moment = require('moment');

const createQuickInvoice = async (req, res) => {
    const t = await QuickInvoice.sequelize.transaction();

    try {
        const { qGRNIds, qInvoiceDate, remark, taxDetails } = req.body;

        // Validate inputs
        if (!qGRNIds || !Array.isArray(qGRNIds) || qGRNIds.length === 0) {
            return res.status(400).json({ message: 'qGRNIds are required and must be a non-empty array.' });
        }
        if (!qInvoiceDate) {
            return res.status(400).json({ message: 'qInvoiceDate is required.' });
        }
        if (!taxDetails || typeof taxDetails !== 'object') {
            return res.status(400).json({ message: 'taxDetails must be provided as an object.' });
        }

        // Fetch all items related to the selected GRNs
        const items = await QuickGRNItem.findAll({
            where: { qGRNId: qGRNIds },
            raw: true
        });

        if (!items.length) {
            await t.rollback();
            return res.status(404).json({ message: 'No items found for the selected GRNs.' });
        }

        // Validate taxDetails for each item
        for (const item of items) {
            if (!taxDetails[item.qGRNItemid] || !Number.isFinite(taxDetails[item.qGRNItemid].taxPercentage) || taxDetails[item.qGRNItemid].taxPercentage < 0) {
                await t.rollback();
                return res.status(400).json({ message: `Invalid or missing taxPercentage for qGRNItemid: ${item.qGRNItemid}.` });
            }
        }

        // Generate Invoice Number: QINV-YYYYMMDD-001
        const today = moment(qInvoiceDate).format('YYYYMMDD');
        const existingInvoicesToday = await QuickInvoice.count({
            where: {
                qInvoiceNo: {
                    [Sequelize.Op.like]: `QINV-${today}%`
                }
            }
        });
        const counter = String(existingInvoicesToday + 1).padStart(3, '0');
        const qInvoiceNo = `QINV-${today}-${counter}`;

        // Prepare and calculate invoice items
        let invoiceTotal = 0.0;
        const invoiceItemsData = items.map(item => {
            const taxPercentage = Number(taxDetails[item.qGRNItemid].taxPercentage);
            const baseAmount = Number(item.quantity) * Number(item.rate) - Number(item.discount || 0);
            const taxAmount = (baseAmount * taxPercentage) / 100;
            const totalAmount = baseAmount + taxAmount;

            invoiceTotal += totalAmount;

            return {
                qGRNId: item.qGRNId,
                qGRNItemid: item.qGRNItemid,
                itemId: item.itemId,
                unitId: item.unitId,
                quantity: item.quantity,
                rate: Number(item.rate).toFixed(2),
                discount: Number(item.discount || 0).toFixed(2),
                taxPercentage: taxPercentage.toFixed(2),
                taxAmount: taxAmount.toFixed(2),
                totalAmount: totalAmount.toFixed(2)
            };
        });

        // Create the Invoice
        const invoice = await QuickInvoice.create({
            qInvoiceNo,
            qInvoiceDate,
            qGRNIds,
            totalAmount: invoiceTotal.toFixed(2),
            remark
        }, { transaction: t });

        // Add qInvoiceId to invoice items and create them
        const enrichedItems = invoiceItemsData.map(item => ({
            ...item,
            qInvoiceId: invoice.qInvoiceId
        }));

        await QuickInvoiceItem.bulkCreate(enrichedItems, { transaction: t });

        await t.commit();

        // Fetch the created invoice with items for response
        const createdInvoice = await QuickInvoice.findByPk(invoice.qInvoiceId, {
            include: [{ model: QuickInvoiceItem, as: 'quickInvoiceItems' }]
        });

        return res.status(201).json({ message: 'Quick Invoice created successfully.', invoice: createdInvoice });

    } catch (error) {
        await t.rollback();
        console.error('Invoice creation failed:', error);
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

// GET - All Invoices
const getAllQuickInvoices = async (req, res) => {
    try {
        const invoices = await QuickInvoice.findAll({
            include: [{ model: QuickInvoiceItem, as: 'quickInvoiceItems' }]
        });
        return res.status(200).json(invoices);
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching invoices', error: error.message });
    }
};

const getQuickInvoiceById = async (req, res) => {
    try {
        const { id } = req.params;

        const invoice = await QuickInvoice.findByPk(id);
        if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

        const items = await QuickInvoiceItem.findAll({ where: { qInvoiceId: id } });

        return res.status(200).json({ invoice, items });
    } catch (err) {
        return res.status(500).json({ message: 'Error fetching invoice', error: err.message });
    }
};

const updateQuickInvoice = async (req, res) => {
    const t = await QuickInvoice.sequelize.transaction();

    try {
        const { id } = req.params;
        const { qGRNIds, qInvoiceDate, remark, quickInvoiceItems, taxDetails } = req.body;

        // Validate inputs
        if (!qGRNIds || !Array.isArray(qGRNIds) || qGRNIds.length === 0) {
            await t.rollback();
            return res.status(400).json({ message: 'qGRNIds are required and must be a non-empty array.' });
        }
        if (!qInvoiceDate) {
            await t.rollback();
            return res.status(400).json({ message: 'qInvoiceDate is required.' });
        }
        if (!quickInvoiceItems || !Array.isArray(quickInvoiceItems) || quickInvoiceItems.length === 0) {
            await t.rollback();
            return res.status(400).json({ message: 'quickInvoiceItems are required and must be a non-empty array.' });
        }
        if (!taxDetails || typeof taxDetails !== 'object') {
            await t.rollback();
            return res.status(400).json({ message: 'taxDetails must be provided as an object.' });
        }

        // Find the QuickInvoice
        const invoice = await QuickInvoice.findByPk(id, { transaction: t });
        if (!invoice) {
            await t.rollback();
            return res.status(404).json({ message: 'QuickInvoice not found.' });
        }

        // Generate Invoice Number if qInvoiceDate changes
        let qInvoiceNo = invoice.qInvoiceNo;
        const newDate = moment(qInvoiceDate).format('YYYYMMDD');
        const currentDate = moment(invoice.qInvoiceDate).format('YYYYMMDD');
        if (newDate !== currentDate) {
            const existingInvoicesToday = await QuickInvoice.count({
                where: {
                    qInvoiceNo: {
                        [Sequelize.Op.like]: `QINV-${newDate}%`
                    },
                    qInvoiceId: { [Sequelize.Op.ne]: id }
                },
                transaction: t
            });
            const counter = String(existingInvoicesToday + 1).padStart(3, '0');
            qInvoiceNo = `QINV-${newDate}-${counter}`;
        }

        // Fetch all QuickGRNItems for the provided qGRNIds to validate
        const grnItems = await QuickGRNItem.findAll({
            where: { qGRNId: qGRNIds },
            raw: true,
            transaction: t
        });

        if (!grnItems.length) {
            await t.rollback();
            return res.status(404).json({ message: 'No items found for the selected GRNs.' });
        }

        // Validate quickInvoiceItems and taxDetails
        const grnItemIds = grnItems.map(item => item.qGRNItemid);
        for (const item of quickInvoiceItems) {
            if (!grnItemIds.includes(item.qGRNItemid)) {
                await t.rollback();
                return res.status(400).json({ message: `Invalid qGRNItemid: ${item.qGRNItemid}.` });
            }
            if (!taxDetails[item.qGRNItemid] || !Number.isFinite(taxDetails[item.qGRNItemid].taxPercentage) || taxDetails[item.qGRNItemid].taxPercentage < 0) {
                await t.rollback();
                return res.status(400).json({ message: `Invalid or missing taxPercentage for qGRNItemid: ${item.qGRNItemid}.` });
            }
        }

        // Get existing QuickInvoiceItems
        const existingItems = await QuickInvoiceItem.findAll({
            where: { qInvoiceId: id },
            transaction: t
        });

        // Identify items to delete
        const newItemIds = quickInvoiceItems.map(item => item.qInvoiceItemId).filter(id => id);
        const itemsToDelete = existingItems.filter(item => !newItemIds.includes(item.qInvoiceItemId));

        // Delete removed items
        if (itemsToDelete.length > 0) {
            const deleteItemIds = itemsToDelete.map(item => item.qInvoiceItemId);
            await QuickInvoiceItem.destroy({
                where: { qInvoiceItemId: deleteItemIds },
                transaction: t
            });
        }

        // Prepare and calculate invoice items
        let invoiceTotal = 0.0;
        const invoiceItemsData = quickInvoiceItems.map(item => {
            const grnItem = grnItems.find(gi => gi.qGRNItemid === item.qGRNItemid);
            if (!grnItem) {
                throw new Error(`GRN item not found for qGRNItemid: ${item.qGRNItemid}`);
            }

            const taxPercentage = Number(taxDetails[item.qGRNItemid].taxPercentage);
            const baseAmount = Number(item.quantity) * Number(item.rate) - Number(item.discount || 0);
            const taxAmount = (baseAmount * taxPercentage) / 100;
            const totalAmount = baseAmount + taxAmount;

            invoiceTotal += totalAmount;

            return {
                qInvoiceItemId: item.qInvoiceItemId,
                qInvoiceId: id,
                qGRNId: item.qGRNId,
                qGRNItemid: item.qGRNItemid,
                itemId: item.itemId,
                unitId: item.unitId,
                quantity: item.quantity,
                rate: Number(item.rate).toFixed(2),
                discount: Number(item.discount || 0).toFixed(2),
                taxPercentage: taxPercentage.toFixed(2),
                taxAmount: taxAmount.toFixed(2),
                totalAmount: totalAmount.toFixed(2)
            };
        });

        // Update QuickInvoice
        await invoice.update({
            qInvoiceNo,
            qInvoiceDate,
            qGRNIds,
            totalAmount: invoiceTotal.toFixed(2),
            remark
        }, { transaction: t });

        // Update or create QuickInvoiceItems
        for (const item of invoiceItemsData) {
            if (item.qInvoiceItemId) {
                // Update existing item
                const existingItem = await QuickInvoiceItem.findByPk(item.qInvoiceItemId, { transaction: t });
                if (existingItem) {
                    await existingItem.update({
                        qGRNId: item.qGRNId,
                        qGRNItemid: item.qGRNItemid,
                        itemId: item.itemId,
                        unitId: item.unitId,
                        quantity: item.quantity,
                        rate: item.rate,
                        discount: item.discount,
                        taxPercentage: item.taxPercentage,
                        taxAmount: item.taxAmount,
                        totalAmount: item.totalAmount
                    }, { transaction: t });
                }
            } else {
                // Create new item
                await QuickInvoiceItem.create({
                    qInvoiceId: id,
                    qGRNId: item.qGRNId,
                    qGRNItemid: item.qGRNItemid,
                    itemId: item.itemId,
                    unitId: item.unitId,
                    quantity: item.quantity,
                    rate: item.rate,
                    discount: item.discount,
                    taxPercentage: item.taxPercentage,
                    taxAmount: item.taxAmount,
                    totalAmount: item.totalAmount
                }, { transaction: t });
            }
        }

        await t.commit();

        // Fetch updated invoice with items (without transaction)
        const updatedInvoice = await QuickInvoice.findByPk(id, {
            include: [{ model: QuickInvoiceItem, as: 'quickInvoiceItems' }]
        });

        return res.status(200).json({ message: 'Quick Invoice updated successfully.', invoice: updatedInvoice });

    } catch (error) {
        // Only attempt rollback if transaction is still active
        if (!t.finished) {
            await t.rollback();
        }
        console.error('Invoice update failed:', error);
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

module.exports = { createQuickInvoice, getAllQuickInvoices, getQuickInvoiceById, updateQuickInvoice };