const QuickGRN = require('../../models/purchase/quickGRN');
const QuickGRNItem = require('../../models/purchase/quickGRNItem');
const GRNItem = require('../../models/purchase/GRNItem');
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
            quickGRNItems: quickGRNItemsRaw
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
                const filePath = path.join('Uploads', fileName);
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

        // Start transaction
        const transaction = await sequelize.transaction();

        // Generate unique storeCode for each QuickGRNItem in format item-DDMMYY-N
        let storeSequence = 1;
        // Query both GRNItem and QuickGRNItem for the highest sequence
        const lastGRNItem = await GRNItem.findOne({
            where: { storeCode: { [Op.like]: 'Item-%' } },
            order: [['storeCode', 'DESC']],
            transaction
        });

        const lastQuickGRNItem = await QuickGRNItem.findOne({
            where: { storeCode: { [Op.like]: 'Item-%' } },
            order: [['storeCode', 'DESC']],
            transaction
        });

        const sequences = [];

        if (lastGRNItem && lastGRNItem.storeCode) {
            const parts = lastGRNItem.storeCode.split('-');
            if (parts.length === 3) {
                const lastSequence = parseInt(parts[2], 10);
                if (!isNaN(lastSequence)) sequences.push(lastSequence);
            }
        }

        if (lastQuickGRNItem && lastQuickGRNItem.storeCode) {
            const parts = lastQuickGRNItem.storeCode.split('-');
            if (parts.length === 3) {
                const lastSequence = parseInt(parts[2], 10);
                if (!isNaN(lastSequence)) sequences.push(lastSequence);
            }
        }

        if (sequences.length > 0) {
            storeSequence = Math.max(...sequences) + 1;
        }

        // Generate storeCodes for all items in this QuickGRN
        const storeCodes = quickGRNItems.map((_, index) => {
            const nextSequence = storeSequence + index;
            return `Item-${dateString}-${nextSequence}`;
        });

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
                    storeCode: storeCodes[index],
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
            // Clean up uploaded files if transaction fails
            if (documentPaths.length > 0) {
                for (const docPath of documentPaths) {
                    try {
                        await fs.unlink(path.join(__dirname, '../../', docPath));
                    } catch (unlinkError) {
                        console.error(`Failed to delete uploaded file: ${docPath}`, unlinkError);
                    }
                }
            }
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