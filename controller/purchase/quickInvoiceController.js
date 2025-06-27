const QuickInvoiceItem = require('../../models/purchase/quickInvoiceItem');
const QuickGRNItem = require('../../models/purchase/quickGRNItem');
const QuickInvoice = require('../../models/purchase/quickInvoice');
const QuickGRN = require('../../models/purchase/quickGRN');
const { Sequelize } = require('sequelize');
const moment = require('moment');

// Utility function for calculations
const calculateItemAmounts = (quantity, rate, discount, taxPercentage) => {
  const qty = Number(quantity) || 0;
  const rt = Number(rate) || 0;
  const disc = Number(discount) || 0;
  const taxPct = Number(taxPercentage) || 0;

  console.log(`Calculating for qty=${qty}, rate=${rt}, discount=${disc}, taxPercentage=${taxPct}`);

  if (disc < 0 || disc > 100) {
    throw new Error('Discount must be between 0 and 100%.');
  }
  if (taxPct < 0) {
    throw new Error('Tax percentage cannot be negative.');
  }

  const amount = qty * rt * (1 - disc / 100);
  if (amount < 0) {
    throw new Error('Calculated amount cannot be negative.');
  }
  const taxAmount = (amount * taxPct) / 100;
  const totalAmount = amount + taxAmount;

  return {
    amount: parseFloat(amount.toFixed(2)),
    taxAmount: parseFloat(taxAmount.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2)),
  };
};

const createQuickInvoice = async (req, res) => {
  const t = await QuickInvoice.sequelize.transaction();

  try {
    const { qGRNIds, qInvoiceDate, remark, taxDetails, quickInvoiceItems } = req.body;

    console.log('Create Quick Invoice Payload:', JSON.stringify({ qGRNIds, qInvoiceDate, remark, taxDetails, quickInvoiceItems }, null, 2));

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

    // Fetch all items related to the selected GRNs
    const grnItems = await QuickGRNItem.findAll({
      where: { qGRNId: qGRNIds },
      raw: true,
    });

    if (!grnItems.length) {
      await t.rollback();
      return res.status(404).json({ message: 'No items found for the selected GRNs.' });
    }

    // Validate quickInvoiceItems and taxDetails
    const grnItemIds = grnItems.map((item) => item.qGRNItemid);
    for (const item of quickInvoiceItems) {
      if (!grnItemIds.includes(item.qGRNItemid)) {
        await t.rollback();
        return res.status(400).json({ message: `Invalid qGRNItemid: ${item.qGRNItemid}.` });
      }
      if (!taxDetails[item.qGRNItemid] || !Number.isFinite(taxDetails[item.qGRNItemid].taxPercentage)) {
        await t.rollback();
        return res.status(400).json({ message: `Invalid or missing taxPercentage for qGRNItemid: ${item.qGRNItemid}.` });
      }
      if (!Number.isFinite(item.discount) || item.discount < 0 || item.discount > 100) {
        await t.rollback();
        return res.status(400).json({ message: `Invalid discount for qGRNItemid: ${item.qGRNItemid}. Must be between 0 and 100.` });
      }
    }

    // Generate Invoice Number: QINV-YYYYMMDD-001
    const today = moment(qInvoiceDate).format('YYYYMMDD');
    const existingInvoicesToday = await QuickInvoice.count({
      where: {
        qInvoiceNo: {
          [Sequelize.Op.like]: `QINV-${today}%`,
        },
      },
    });
    const counter = String(existingInvoicesToday + 1).padStart(3, '0');
    const qInvoiceNo = `QINV-${today}-${counter}`;

    // Prepare and calculate invoice items
    let invoiceTotal = 0;
    const invoiceItemsData = quickInvoiceItems.map((item) => {
      const grnItem = grnItems.find((gi) => gi.qGRNItemid === item.qGRNItemid);
      if (!grnItem) {
        throw new Error(`GRN item not found for qGRNItemid: ${item.qGRNItemid}`);
      }
      const taxPercentage = Number(taxDetails[item.qGRNItemid].taxPercentage);
      const discount = Number(item.discount); // Use discount from quickInvoiceItems
      console.log(`Processing item ${item.qGRNItemid} with discount=${discount}`);
      const { amount, taxAmount, totalAmount } = calculateItemAmounts(
        item.quantity,
        item.rate,
        discount,
        taxPercentage
      );

      invoiceTotal += totalAmount;

      return {
        qGRNId: item.qGRNId,
        qGRNItemid: item.qGRNItemid,
        itemId: item.itemId,
        unitId: item.unitId,
        quantity: item.quantity,
        rate: parseFloat(Number(item.rate).toFixed(2)),
        discount: parseFloat(discount.toFixed(2)),
        amount,
        taxPercentage: parseFloat(taxPercentage.toFixed(2)),
        taxAmount,
        totalAmount,
      };
    });

    // Create the Invoice
    const invoice = await QuickInvoice.create(
      {
        qInvoiceNo,
        qInvoiceDate,
        qGRNIds,
        totalAmount: parseFloat(invoiceTotal.toFixed(2)),
        remark,
      },
      { transaction: t }
    );

    // Add qInvoiceId to invoice items and create them
    const enrichedItems = invoiceItemsData.map((item) => ({
      ...item,
      qInvoiceId: invoice.qInvoiceId,
    }));

    await QuickInvoiceItem.bulkCreate(enrichedItems, { transaction: t });

    await t.commit();

    // Fetch the created invoice with items for response
    const createdInvoice = await QuickInvoice.findByPk(invoice.qInvoiceId, {
      include: [{ model: QuickInvoiceItem, as: 'quickInvoiceItems' }],
    });

    return res.status(201).json({ message: 'Quick Invoice created successfully.', invoice: createdInvoice });
  } catch (error) {
    await t.rollback();
    console.error('Invoice creation failed:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

const getAllQuickInvoices = async (req, res) => {
  try {
    const invoices = await QuickInvoice.findAll({
      include: [{ model: QuickInvoiceItem, as: 'quickInvoiceItems' }],
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

    console.log('Update Quick Invoice Payload:', JSON.stringify({ qGRNIds, qInvoiceDate, remark, quickInvoiceItems, taxDetails }, null, 2));

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
            [Sequelize.Op.like]: `QINV-${newDate}%`,
          },
          qInvoiceId: { [Sequelize.Op.ne]: id },
        },
        transaction: t,
      });
      const counter = String(existingInvoicesToday + 1).padStart(3, '0');
      qInvoiceNo = `QINV-${newDate}-${counter}`;
    }

    // Fetch all QuickGRNItems for the provided qGRNIds
    const grnItems = await QuickGRNItem.findAll({
      where: { qGRNId: qGRNIds },
      raw: true,
      transaction: t,
    });

    if (!grnItems.length) {
      await t.rollback();
      return res.status(404).json({ message: 'No items found for the selected GRNs.' });
    }

    // Validate quickInvoiceItems and taxDetails
    const grnItemIds = grnItems.map((item) => item.qGRNItemid);
    for (const item of quickInvoiceItems) {
      if (!grnItemIds.includes(item.qGRNItemid)) {
        await t.rollback();
        return res.status(400).json({ message: `Invalid qGRNItemid: ${item.qGRNItemid}.` });
      }
      if (!taxDetails[item.qGRNItemid] || !Number.isFinite(taxDetails[item.qGRNItemid].taxPercentage)) {
        await t.rollback();
        return res.status(400).json({ message: `Invalid or missing taxPercentage for qGRNItemid: ${item.qGRNItemid}.` });
      }
      if (!Number.isFinite(item.discount) || item.discount < 0 || item.discount > 100) {
        await t.rollback();
        return res.status(400).json({ message: `Invalid discount for qGRNItemid: ${item.qGRNItemid}. Must be between 0 and 100.` });
      }
    }

    // Get existing QuickInvoiceItems
    const existingItems = await QuickInvoiceItem.findAll({
      where: { qInvoiceId: id },
      transaction: t,
    });

    // Identify items to delete
    const newItemIds = quickInvoiceItems.map((item) => item.qInvoiceItemId).filter((id) => id);
    const itemsToDelete = existingItems.filter((item) => !newItemIds.includes(item.qInvoiceItemId));

    // Delete removed items
    if (itemsToDelete.length > 0) {
      const deleteItemIds = itemsToDelete.map((item) => item.qInvoiceItemId);
      await QuickInvoiceItem.destroy({
        where: { qInvoiceItemId: deleteItemIds },
        transaction: t,
      });
    }

    // Prepare and calculate invoice items
    let invoiceTotal = 0;
    const invoiceItemsData = quickInvoiceItems.map((item) => {
      const grnItem = grnItems.find((gi) => gi.qGRNItemid === item.qGRNItemid);
      if (!grnItem) {
        throw new Error(`GRN item not found for qGRNItemid: ${item.qGRNItemid}`);
      }

      const taxPercentage = Number(taxDetails[item.qGRNItemid].taxPercentage);
      const discount = Number(item.discount); // Use discount from quickInvoiceItems
      console.log(`Updating item ${item.qGRNItemid} with discount=${discount}`);
      const { amount, taxAmount, totalAmount } = calculateItemAmounts(
        item.quantity,
        item.rate,
        discount,
        taxPercentage
      );

      invoiceTotal += totalAmount;

      return {
        qInvoiceItemId: item.qInvoiceItemId,
        qInvoiceId: id,
        qGRNId: item.qGRNId,
        qGRNItemid: item.qGRNItemid,
        itemId: item.itemId,
        unitId: item.unitId,
        quantity: item.quantity,
        rate: parseFloat(Number(item.rate).toFixed(2)),
        discount: parseFloat(discount.toFixed(2)),
        amount,
        taxPercentage: parseFloat(taxPercentage.toFixed(2)),
        taxAmount,
        totalAmount,
      };
    });

    // Update QuickInvoice
    await invoice.update(
      {
        qInvoiceNo,
        qInvoiceDate,
        qGRNIds,
        totalAmount: parseFloat(invoiceTotal.toFixed(2)),
        remark,
      },
      { transaction: t }
    );

    // Update or create QuickInvoiceItems
    for (const item of invoiceItemsData) {
      if (item.qInvoiceItemId) {
        const existingItem = await QuickInvoiceItem.findByPk(item.qInvoiceItemId, { transaction: t });
        if (existingItem) {
          await existingItem.update(
            {
              qGRNId: item.qGRNId,
              qGRNItemid: item.qGRNItemid,
              itemId: item.itemId,
              unitId: item.unitId,
              quantity: item.quantity,
              rate: item.rate,
              discount: item.discount,
              amount: item.amount,
              taxPercentage: item.taxPercentage,
              taxAmount: item.taxAmount,
              totalAmount: item.totalAmount,
            },
            { transaction: t }
          );
        }
      } else {
        await QuickInvoiceItem.create(
          {
            qInvoiceId: id,
            qGRNId: item.qGRNId,
            qGRNItemid: item.qGRNItemid,
            itemId: item.itemId,
            unitId: item.unitId,
            quantity: item.quantity,
            rate: item.rate,
            discount: item.discount,
            amount: item.amount,
            taxPercentage: item.taxPercentage,
            taxAmount: item.taxAmount,
            totalAmount: item.totalAmount,
          },
          { transaction: t }
        );
      }
    }

    await t.commit();

    const updatedInvoice = await QuickInvoice.findByPk(id, {
      include: [{ model: QuickInvoiceItem, as: 'quickInvoiceItems' }],
    });

    return res.status(200).json({ message: 'Quick Invoice updated successfully.', invoice: updatedInvoice });
  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }
    console.error('Invoice update failed:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

module.exports = { updateQuickInvoice, createQuickInvoice, getAllQuickInvoices, getQuickInvoiceById };