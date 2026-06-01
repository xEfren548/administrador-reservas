const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const Habitacion = require('../models/Habitacion');
const { TIME_PATTERN, normalizeStoredTime } = require('../utils/time');

function parseArgs(argv) {
    const options = {
        write: false,
        limit: null,
        dbUrl: null,
        help: false
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--write') {
            options.write = true;
            continue;
        }

        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }

        if (arg.startsWith('--limit=')) {
            const parsedLimit = Number(arg.split('=')[1]);
            options.limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;
            continue;
        }

        if (arg === '--limit') {
            const parsedLimit = Number(argv[index + 1]);
            options.limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;
            index += 1;
            continue;
        }

        if (arg.startsWith('--db-url=')) {
            options.dbUrl = arg.slice('--db-url='.length);
            continue;
        }

        if (arg === '--db-url') {
            options.dbUrl = argv[index + 1] || null;
            index += 1;
        }
    }

    return options;
}

function printHelp() {
    console.log('Uso: node scripts/migrateChaletTimesToStrings.js [--write] [--limit N] [--db-url URL]');
    console.log('');
    console.log('Opciones:');
    console.log('  --write       Aplica los cambios en MongoDB. Sin esta bandera solo hace dry-run.');
    console.log('  --limit N     Procesa solo N cabañas candidatas.');
    console.log('  --db-url URL  Usa una cadena de conexion especifica.');
    console.log('  --help        Muestra esta ayuda.');
}

function resolveDbUrl(explicitDbUrl) {
    if (explicitDbUrl) {
        return explicitDbUrl;
    }

    if (process.env.NODE_ENV === 'development' && process.env.DEV_DB) {
        return process.env.DEV_DB;
    }

    return process.env.DB_URL || process.env.DEV_DB || null;
}

function describeValueType(value) {
    if (value instanceof Date) {
        return 'Date';
    }

    if (typeof value === 'string') {
        return 'String';
    }

    if (value === null || value === undefined) {
        return 'Empty';
    }

    return typeof value;
}

function normalizeFieldValue(value, fallback) {
    if (value === null || value === undefined || value === '') {
        return {
            ok: true,
            nextValue: value,
            reason: 'empty'
        };
    }

    if (typeof value === 'string' && TIME_PATTERN.test(value.trim())) {
        return {
            ok: true,
            nextValue: value.trim(),
            reason: 'already-normalized'
        };
    }

    const nextValue = normalizeStoredTime(value, null);
    if (!nextValue) {
        return {
            ok: false,
            nextValue: null,
            reason: 'unrecognized-format'
        };
    }

    return {
        ok: true,
        nextValue,
        reason: 'normalized'
    };
}

function formatPreviewValue(value) {
    if (value instanceof Date) {
        return value.toISOString();
    }

    return String(value);
}

function hasNonZeroMinutes(timeValue) {
    return typeof timeValue === 'string' && TIME_PATTERN.test(timeValue) && !timeValue.endsWith(':00');
}

function shouldFallbackToDefault(normalizationResult) {
    return normalizationResult?.reason === 'normalized' && hasNonZeroMinutes(normalizationResult.nextValue);
}

async function main() {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
        printHelp();
        return;
    }

    const dbUrl = resolveDbUrl(options.dbUrl);
    if (!dbUrl) {
        throw new Error('No se encontro una URL de MongoDB. Usa --db-url o define DB_URL/DEV_DB en .env');
    }

    await mongoose.connect(dbUrl);

    const query = {
        $or: [
            { 'others.arrivalTime': { $type: 'date' } },
            { 'others.departureTime': { $type: 'date' } },
            { 'others.arrivalTime': { $type: 'string' } },
            { 'others.departureTime': { $type: 'string' } }
        ]
    };

    let cursor = Habitacion.collection.find(query, {
        projection: {
            'propertyDetails.name': 1,
            'others.arrivalTime': 1,
            'others.departureTime': 1
        }
    });

    if (options.limit) {
        cursor = cursor.limit(options.limit);
    }

    const summary = {
        inspected: 0,
        candidates: 0,
        updated: 0,
        fallbackApplied: 0,
        unchanged: 0,
        skipped: 0
    };

    for await (const chalet of cursor) {
        summary.inspected += 1;

        const arrivalResult = normalizeFieldValue(chalet?.others?.arrivalTime, '15:00');
        const departureResult = normalizeFieldValue(chalet?.others?.departureTime, '12:00');

        if (!arrivalResult.ok || !departureResult.ok) {
            summary.skipped += 1;
            console.log(`[SKIP] ${chalet.propertyDetails?.name || chalet._id}`);
            console.log(`  arrivalTime (${describeValueType(chalet?.others?.arrivalTime)}): ${formatPreviewValue(chalet?.others?.arrivalTime)}`);
            console.log(`  departureTime (${describeValueType(chalet?.others?.departureTime)}): ${formatPreviewValue(chalet?.others?.departureTime)}`);
            console.log(`  reason: ${!arrivalResult.ok ? 'arrivalTime invalido' : 'departureTime invalido'}`);
            continue;
        }

        const currentArrival = chalet?.others?.arrivalTime;
        const currentDeparture = chalet?.others?.departureTime;
        let nextArrival = arrivalResult.nextValue;
        let nextDeparture = departureResult.nextValue;
        const fallbackArrival = shouldFallbackToDefault(arrivalResult);
        const fallbackDeparture = shouldFallbackToDefault(departureResult);

        if (fallbackArrival) {
            nextArrival = '15:00';
        }

        if (fallbackDeparture) {
            nextDeparture = '12:00';
        }

        const arrivalChanged = !(typeof currentArrival === 'string' && currentArrival.trim() === nextArrival);
        const departureChanged = !(typeof currentDeparture === 'string' && currentDeparture.trim() === nextDeparture);

        if (!arrivalChanged && !departureChanged) {
            summary.unchanged += 1;
            continue;
        }

        console.log(`[${options.write ? 'WRITE' : 'DRY'}] ${chalet.propertyDetails?.name || chalet._id}`);
        console.log(`  arrivalTime: ${formatPreviewValue(currentArrival)} -> ${nextArrival}`);
        console.log(`  departureTime: ${formatPreviewValue(currentDeparture)} -> ${nextDeparture}`);
        if (fallbackArrival || fallbackDeparture) {
            summary.fallbackApplied += 1;
            console.log('  fallback: minutos no validos detectados en dato legado, se usara 15:00/12:00');
        }

        summary.candidates += 1;

        if (options.write) {
            await Habitacion.collection.updateOne(
                { _id: chalet._id },
                {
                    $set: {
                        'others.arrivalTime': nextArrival,
                        'others.departureTime': nextDeparture
                    }
                }
            );
            summary.updated += 1;
        }
    }

    console.log('');
    console.log('Resumen de migracion:');
    console.log(`  inspeccionadas: ${summary.inspected}`);
    console.log(`  candidatas a actualizar: ${summary.candidates}`);
    console.log(`  actualizadas: ${summary.updated}`);
    console.log(`  fallback aplicado automaticamente: ${summary.fallbackApplied}`);
    console.log(`  sin cambios: ${summary.unchanged}`);
    console.log(`  omitidas: ${summary.skipped}`);

    if (!options.write) {
        console.log('');
        console.log('Dry-run completado. Ejecuta con --write para aplicar cambios.');
    }
}

main()
    .then(async () => {
        await mongoose.connection.close();
    })
    .catch(async (error) => {
        console.error('Error en la migracion de horarios de cabañas:', error.message);
        await mongoose.connection.close();
        process.exitCode = 1;
    });