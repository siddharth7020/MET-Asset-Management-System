const QuickGRN = require('../../models/purchase/quickGRN');
const QuickGRNItem = require('../../models/purchase/quickGRNItem');
const StockStorage = require('../../models/distribution/stockStorage');
const sequelize = require('../../config/database');
const { Op } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');

const getAllQuickGRNs = async (req, res) => {
    try {
        const quickGRNs = await QuickGRN.findAll({
            include: [{ model: QuickGRNItem, as: 'items' }]
        });
        res.status(200).json(quickGRNs);
    } catch (error) {
        console.error('Error fetching Quick GRNs:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

const getQuickGRNById = async (req, res) => {
    try {
        const { id } = req.params;
        const quickGRN = await QuickGRN.findByPk(id, {
            include: [{ model: QuickGRNItem, as: 'items' }]
        });
        if (!quickGRN) {
            return res.status(404).json({ message: 'Quick GRN not found' });
        }
        res.status(200).json(quickGRN);
    } catch (error) {
        console.error('Error fetching Quick GRN:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

const createQuickGRN = async (req, res) => {
    try {
      const {
        qGRNDate = new Date(),
        instituteId,
        financialYearId,
        vendorId,
        challanNo,
        challanDate,
        requestedBy,
        remark,
        quickGRNItems: quickGRNItemsRaw // Rename to avoid confusion
      } = req.body;
  
      // Parse quickGRNItems if it's a string
      let quickGRNItems = quickGRNItemsRaw;
      if (typeof quickGRNItemsRaw === 'string') {
        try {
          quickGRNItems = JSON.parse(quickGRNItemsRaw);
        } catch (error) {
          return res.status(400).json({ message: 'Invalid quickGRNItems format. Expected a JSON array.' });
        }
      }
  
      // Validate that quickGRNItems is an array
      if (!Array.isArray(quickGRNItems)) {
        return res.status(400).json({ message: 'quickGRNItems must be an array.' });
      }
  
      // Validate required fields
      if (!qGRNDate || !instituteId || !financialYearId || !vendorId) {
        return res.status(400).json({ message: 'qGRNDate, instituteId, financialYearId, and vendorId are required' });
      }
  
      // Handle multiple file uploads
      let documentPaths = [];
      if (req.files && req.files.documents) {
        const documents = Array.isArray(req.files.documents) ? req.files.documents : [req.files.documents];
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        const maxFileSize = 10 * 1024 * 1024; // 10MB
  
        for (const document of documents) {
          if (!allowedTypes.includes(document.mimetype)) {
            return res.status(400).json({ message: `Invalid file type for ${document.name}. Only PDF, JPEG, and PNG are allowed.` });
          }
          if (document.size > maxFileSize) {
            return res.status(400).json({ message: `File ${document.name} exceeds 10MB limit.` });
          }
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const fileExtension = path.extname(document.name);
          const fileName = `document-${uniqueSuffix}${fileExtension}`;
          const filePath = path.join('uploads', fileName);
          await fs.mkdir(path.join(__dirname, '../../Uploads'), { recursive: true });
          await document.mv(path.join(__dirname, '../../', filePath));
          documentPaths.push(filePath);
        }
      }
  
      // Generate qGRNNo in format QGRN-DDMMYY-XX
      const date = new Date(qGRNDate);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
      const dateString = `${day}${month}${year}`;
  
      const lastQuickGRN = await QuickGRN.findOne({
        where: { qGRNNo: { [Op.like]: `QGRN-%` } },
        order: [['qGRNNo', 'DESC']]
      });
  
      let sequence = 1;
      if (lastQuickGRN && lastQuickGRN.qGRNNo) {
        const parts = lastQuickGRN.qGRNNo.split('-');
        const lastSeq = parts[2];
        if (!isNaN(lastSeq)) {
          sequence = parseInt(lastSeq, 10) + 1;
        } else {
          console.warn(`Invalid qGRNNo format found: ${lastQuickGRN.qGRNNo}. Starting sequence at 1.`);
        }
      }
  
      const qGRNNo = `QGRN-${dateString}-${String(sequence).padStart(2, '0')}`;

          // Generate storeCode for each GRNItem in format item-DDMMYY-N
          const storeCodePromises = quickGRNItems.map(async (item) => {
            const lastStoreCode = await QuickGRNItem.findOne({
                where: { storeCode: { [Op.like]: `item-${dateString}-%` } },
                order: [['storeCode', 'DESC']]
            });
            let storeSequence = 1;
            if (lastStoreCode) {
                const lastStoreSequence = parseInt(lastStoreCode.storeCode.split('-')[2], 10);
                storeSequence = lastStoreSequence + 1;
            }
            return `item-${dateString}-${storeSequence}`;
        });
        const storeCodes = await Promise.all(storeCodePromises);
  
      const transaction = await sequelize.transaction();
      try {
        // Create QuickGRN
        const quickGRN = await QuickGRN.create({
          qGRNDate,
          qGRNNo,
          instituteId,
          financialYearId,
          vendorId,
          challanNo,
          challanDate,
          document: documentPaths.length > 0 ? documentPaths : null,
          requestedBy,
          remark
        }, { transaction });
  
        // Create associated QuickGRN Items
        let quickGRNItemData = [];
        if (quickGRNItems && quickGRNItems.length > 0) {
          quickGRNItemData = quickGRNItems.map((item, index) => ({
            qGRNId: quickGRN.qGRNId,
            storeCode: storeCodes[index], // Assign generated storeCode
            itemId: item.itemId,
            unitId: item.unitId,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.quantity * item.rate,
            discount: item.discount || 0,
            totalAmount: (item.quantity * item.rate) * (1 - (item.discount / 100)) 
          }));
          await QuickGRNItem.bulkCreate(quickGRNItemData, { transaction });
        }
  
        // Stock Update in StockStorage
        for (const item of quickGRNItemData) {
          const stockRecord = await StockStorage.findOne({
            where: { qGRNId: quickGRN.qGRNId, itemId: item.itemId },
            transaction
          });
  
          if (stockRecord) {
            await stockRecord.update({
              quantity: stockRecord.quantity + item.quantity,
              remark: remark || stockRecord.remark
            }, { transaction });
          } else {
            await StockStorage.create({
              poId: null,
              grnId: null,
              qGRNId: quickGRN.qGRNId,
              storeCode: item.storeCode,
              itemId: item.itemId,
              unitId: item.unitId,
              quantity: item.quantity,
              remark: remark || null
            }, { transaction });
          }
        }
  
        await transaction.commit();
        const createdQuickGRN = await QuickGRN.findByPk(quickGRN.qGRNId, {
          include: [{ model: QuickGRNItem, as: 'items' }]
        });
        res.status(201).json(createdQuickGRN);
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error creating QuickGRN:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  };

module.exports = {
    createQuickGRN,
    getQuickGRNById,
    getAllQuickGRNs
};