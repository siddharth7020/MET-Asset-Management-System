const QuickInvoiceItem = require('../../models/purchase/quickInvoiceItem');
const QuickGRNItem = require('../../models/purchase/quickGRNItem');
const QuickInvoice = require('../../models/purchase/quickInvoice');
const QuickGRN = require('../../models/purchase/quickGRN');
const { Sequelize } = require('sequelize');
const moment = require('moment');
const path = require('path');

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
    // Parse FormData fields
    let { qGRNIds, qInvoiceDate, remark, taxDetails, quickInvoiceItems, existingDocuments } = req.body;
    
    // Parse JSON-stringified fields
    try {
      qGRNIds = qGRNIds ? JSON.parse(qGRNIds) : [];
      taxDetails = taxDetails ? JSON.parse(taxDetails) : {};
      quickInvoiceItems = quickInvoiceItems ? JSON.parse(quickInvoiceItems) : [];
      existingDocuments = existingDocuments ? JSON.parse(existingDocuments) : [];
    } catch (error) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid JSON format in form data.' });
    }

    let documentPaths = Array.isArray(existingDocuments) ? existingDocuments : [];

    console.log('Create Quick Invoice Payload:', JSON.stringify({ qGRNIds, qInvoiceDate, remark, taxDetails, quickInvoiceItems, documentPaths }, null, 2));

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

    // Handle file uploads
    if (req.files && req.files.documents) {
      const files = Array.isArray(req.files.documents) ? req.files.documents : [req.files.documents];
      
      // Validate file types and sizes
      for (const file of files) {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.mimetype)) {
          await t.rollback();
          return res.status(400).json({ message: `Invalid file type for ${file.name}. Allowed types: PDF, JPEG, PNG.` });
        }
        if (file.size > 10 * 1024 * 1024) {
          await t.rollback();
          return res.status(400).json({ message: `File ${file.name} exceeds 10MB limit.` });
        }
      }

      // Move files to uploads directory and store paths
      for (const file of files) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `${uniqueSuffix}-${file.name}`;
        const filePath = path.join('uploads', fileName);
        await file.mv(path.join(__dirname, '..', '..', filePath));
        documentPaths.push(`/uploads/${fileName}`);
      }
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
      const discount = Number(item.discount);
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
        document: documentPaths,
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
    // Parse FormData fields
    let { qGRNIds, qInvoiceDate, remark, quickInvoiceItems, taxDetails, existingDocuments } = req.body;

    // Parse JSON-stringified fields
    try {
      qGRNIds = qGRNIds ? JSON.parse(qGRNIds) : [];
      taxDetails = taxDetails ? JSON.parse(taxDetails) : {};
      quickInvoiceItems = quickInvoiceItems ? JSON.parse(quickInvoiceItems) : [];
      existingDocuments = existingDocuments ? JSON.parse(existingDocuments) : [];
    } catch (error) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid JSON format in form data.' });
    }

    let documentPaths = Array.isArray(existingDocuments) ? existingDocuments : [];

    console.log('Update Quick Invoice Payload:', JSON.stringify({ qGRNIds, qInvoiceDate, remark, quickInvoiceItems, taxDetails, documentPaths }, null, 2));

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

    // Handle file uploads
    if (req.files && req.files.documents) {
      const files = Array.isArray(req.files.documents) ? req.files.documents : [req.files.documents];
      
      // Validate file types and sizes
      for (const file of files) {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.mimetype)) {
          await t.rollback();
          return res.status(400).json({ message: `Invalid file type for ${file.name}. Allowed types: PDF, JPEG, PNG.` });
        }
        if (file.size > 10 * 1024 * 1024) {
          await t.rollback();
          return res.status(400).json({ message: `File ${file.name} exceeds 10MB limit.` });
        }
      }

      // Move files to uploads directory and store paths
      for (const file of files) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `${uniqueSuffix}-${file.name}`;
        const filePath = path.join('uploads', fileName);
        await file.mv(path.join(__dirname, '..', '..', filePath));
        documentPaths.push(`/uploads/${fileName}`);
      }
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
      const discount = Number(item.discount);
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
        document: documentPaths,
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