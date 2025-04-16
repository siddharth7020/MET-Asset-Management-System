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

        if (!qGRNIds || !Array.isArray(qGRNIds) || qGRNIds.length === 0) {
            return res.status(400).json({ message: 'GRN IDs are required.' });
        }

        // 1. Fetch all items related to the selected GRNs
        const items = await QuickGRNItem.findAll({
            where: { qGRNId: qGRNIds },
            raw: true
        });

        if (!items.length) {
            return res.status(404).json({ message: 'No items found for the selected GRNs.' });
        }

        // 2. Generate Invoice Number: QINV-YYYYMMDD-001
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

        // 3. Prepare and calculate invoice items
        let invoiceTotal = 0.0;
        const invoiceItemsData = items.map(item => {
            const taxPercentage = taxDetails[item.qGRNItemid]?.taxPercentage || 0;
            const baseAmount = parseFloat(item.totalAmount);
            const taxAmount = parseFloat((baseAmount * taxPercentage) / 100);
            const totalAmount = baseAmount + taxAmount;

            invoiceTotal += totalAmount;

            return {
                qGRNId: item.qGRNId,
                qGRNItemid: item.qGRNItemid,
                itemId: item.itemId,
                quantity: item.quantity,
                rate: item.rate,
                discount: item.discount,
                taxPercentage,
                taxAmount,
                totalAmount
            };
        });

        // 4. Create the Invoice
        const invoice = await QuickInvoice.create({
            qInvoiceNo,
            qInvoiceDate,
            qGRNIds,
            totalAmount: invoiceTotal.toFixed(2),
            remark
        }, { transaction: t });

        // 5. Add invoiceId to invoice items and create them
        const enrichedItems = invoiceItemsData.map(item => ({
            ...item,
            qInvoiceId: invoice.qInvoiceId
        }));

        await QuickInvoiceItem.bulkCreate(enrichedItems, { transaction: t });

        await t.commit();
        return res.status(201).json({ message: 'Quick Invoice created successfully.', invoice });

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
            order: [['createdAt', 'DESC']]
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

module.exports = { createQuickInvoice, getAllQuickInvoices, getQuickInvoiceById };