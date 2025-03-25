const Category = require('../../models/master/category');

exports.getCategory = (req, res, next) => {
    Category.findAll()
        .then(categories => {
            res.status(200).json({
                message: 'Fetched categories successfully.',
                categories: categories
            });
        })
        .catch(err => {
            console.log(err);
        });
};

exports.createCategory = async (req, res, next) => {
    const categoryName = req.body.categoryName;
    try{
        const category = await Category.create({
            categoryName: categoryName
        });
        res.status(200).json({
            message: 'Category created successfully.',
            category: category
        });
    }catch(err){
        console.log(err);
    }
};

exports.updateCategory = async (req, res, next) => {
    const id = req.params.id;
    const categoryName = req.body.categoryName;
    try{
        const category = await Category.findByPk(id);
        if(!category){
            res.status(404).json({
                message: 'Category not found.'
            });
        }
        category.categoryName = categoryName;
        await category.save();
        res.status(200).json({
            message: 'Category updated successfully.',
            category: category
        });
    }catch(err){
        console.log(err);
    }
};

exports.deleteCategory = async (req, res, next) => {
    const id = req.params.id;
    try{
        const category = await Category.findByPk(id);
        if(!category){
            res.status(404).json({
                message: 'Category not found.'
            });
        }
        await category.destroy();
        res.status(200).json({
            message: 'Category deleted successfully.'
        });
    }catch(err){
        console.log(err);
    }
};