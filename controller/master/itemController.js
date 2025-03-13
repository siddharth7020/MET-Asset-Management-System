const Item = require('../../model/master/item');

exports.getItem = async (req, res, next) => {
    try {
        const items = await Item.findAll();
        res.status(200).json({massage: "Fetched items successfully.", items: items});
    } catch (error) {
        console.log(error);
    }
};

exports.createItems = async (req, res, next) => {
    const itemCategory = req.body.itemCategory;
    const itemName = req.body.itemName;
    const itemCode = req.body.itemCode;
    const unit = req.body.unit;
    const remark = req.body.remark;
    try {
        const item = await Item.create({itemCategory, itemName, itemCode, unit, remark});
        res.status(200).json({massage: "Item created successfully.", item: item});
    } catch (error) {
        console.log(error);
    }
};

exports.updateItem = async (req, res, next) => {
    const id = req.params.id;
    const itemCategory = req.body.itemCategory;
    const itemName = req.body.itemName;
    const itemCode = req.body.itemCode;
    const unit = req.body.unit;
    const remark = req.body.remark;
    try {
        const item = await Item.findByPk(id);
        await item.update({itemCategory, itemName, itemCode, unit, remark});
        res.status(200).json({massage: "Item updated successfully.", item: item});
    } catch (error) {
        console.log(error);
    }
};

exports.deleteItem = async (req, res, next) => {
    const id = req.params.id;
    try {
        const item = await Item.findByPk(id);
        await item.destroy();
        res.status(200).json({massage: "Item deleted successfully."});
    } catch (error) {
        console.log(error);
    }    
};