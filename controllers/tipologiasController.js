const mongoose = require('mongoose')
const TipologiasCabana = require('../models/TipologiasCabana')

async function renderTipologiaView(req, res, next) {
    const tipologias = await TipologiasCabana.find().lean();

    res.render('tipologiasView', {
        tipologias: tipologias
    })
}

async function getTipologias(req, res, next) {
    const tipologias = await TipologiasCabana.find()
    res.send(tipologias)
}

async function createTipologia(req, res, next) {
    try {

        const { tipologia } = req.body;
        const newTipologia = new TipologiasCabana({
            tipologia: tipologia
        })
        await newTipologia.save();
        res.status(200).send({ message: 'Tipologia saved successfully' })
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Something went wrong while creating tipologia.');
    }
}

async function editTipologia(req, res, next) {
    try {
        const { id } = req.params;
        const { tipologia } = req.body;

        const updateFields = {};
        if (tipologia) { updateFields.tipologia = tipologia; }

        await TipologiasCabana.findByIdAndUpdate(id, updateFields);
        res.status(200).send({ message: 'Tipologia updated successfully' })

    } catch (error) {
        console.log(error.message);
        res.status(500).send('Something went wrong while editing tipologia.');
    }

}

async function deleteTipologia(req, res, next) {
    try {
        const { id } = req.params;

        await TipologiasCabana.findByIdAndDelete(id);
        res.status(200).send({ message: 'Tipologia deleted' })

    } catch (error) {
        console.log(error.message);
        res.status(500).send('Something went wrong while deleting tipologia.');
    }
}


module.exports = {
    renderTipologiaView,
    createTipologia,
    editTipologia,
    deleteTipologia
}