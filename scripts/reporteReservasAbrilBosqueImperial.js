const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const Documento = require('../models/Evento');
const Habitacion = require('../models/Habitacion');

const ROOM_NAMES = [
    'BOSQUE IMPERIAL MILAN1 CAP 2 PAX',
    'BOSQUE IMPERIAL MILAN2 CAP 2 PAX',
    'BOSQUE IMPERIAL MILAN3 CAP 2 PAX',
    'BOSQUE IMPERIAL MILAN4 CAP 2 PAX'
];

const EXCLUDED_STATUSES = ['cancelled', 'no-show', 'playground', 'reserva de dueño'];
const MONTHS_BY_NAME = {
    enero: 1,
    febrero: 2,
    marzo: 3,
    abril: 4,
    mayo: 5,
    junio: 6,
    julio: 7,
    agosto: 8,
    septiembre: 9,
    setiembre: 9,
    octubre: 10,
    noviembre: 11,
    diciembre: 12
};

function normalizeText(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function parseMonth(value) {
    if (value === undefined) {
        return new Date().getUTCMonth() + 1;
    }

    const normalizedValue = normalizeText(value);
    const monthAsNumber = Number(normalizedValue);

    if (Number.isInteger(monthAsNumber) && monthAsNumber >= 1 && monthAsNumber <= 12) {
        return monthAsNumber;
    }

    const monthFromName = MONTHS_BY_NAME[normalizedValue];
    if (monthFromName) {
        return monthFromName;
    }

    throw new Error('Mes invalido. Usa un numero del 1 al 12 o un nombre de mes en espanol.');
}

function parseYear(value) {
    if (value === undefined) {
        return new Date().getUTCFullYear();
    }

    const year = Number(value);
    if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
        return year;
    }

    throw new Error('Anio invalido. Usa un anio numerico, por ejemplo 2026.');
}

function buildMonthRange(year, month) {
    return {
        start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
        end: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))
    };
}

async function main() {
    const dbUrl = process.env.DEV_DB;

    if (!dbUrl) {
        throw new Error('DEV_DB no esta definida en el archivo .env');
    }

    const targetMonth = parseMonth(process.argv[2]);
    const targetYear = parseYear(process.argv[3]);
    const { start, end } = buildMonthRange(targetYear, targetMonth);

    await mongoose.connect(dbUrl);

    const reservationCollectionName = Documento.collection.name;

    const reservasPorHabitacion = await Habitacion.aggregate([
        {
            $match: {
                'propertyDetails.name': { $in: ROOM_NAMES }
            }
        },
        {
            $lookup: {
                from: reservationCollectionName,
                let: { habitacionId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            status: { $nin: EXCLUDED_STATUSES },
                            reservationDate: { $gte: start, $lt: end },
                            $expr: { $eq: ['$resourceId', '$$habitacionId'] }
                        }
                    },
                    {
                        $count: 'total'
                    }
                ],
                as: 'reservas'
            }
        },
        {
            $project: {
                _id: 0,
                nombreHabitacion: '$propertyDetails.name',
                noReservas: {
                    $ifNull: [{ $arrayElemAt: ['$reservas.total', 0] }, 0]
                }
            }
        }
    ]);

    const conteosPorNombre = new Map(
        reservasPorHabitacion.map((item) => [item.nombreHabitacion, item.noReservas])
    );

    ROOM_NAMES.forEach((roomName) => {
        console.log(`${roomName} -> Reservas: ${conteosPorNombre.get(roomName) ?? 0}`);
    });
}

main()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });