/**
 * Reads GOG Galaxy sqlite DB — run via Electron as Node (ELECTRON_RUN_AS_NODE=1).
 * stdout: JSON array of { releaseKey, productId, title }
 */
import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function parseTitleValue(raw) {
    if (raw == null) return ''
    const text = String(raw).trim()
    if (!text) return ''
    try {
        const parsed = JSON.parse(text)
        return (parsed.title || '').trim()
    } catch {
        return text
    }
}

function releaseKeyToProductId(releaseKey) {
    const key = releaseKey.trim()
    const gogMatch = key.match(/^gog_(\d+)/i)
    if (gogMatch) return gogMatch[1]
    const tailDigits = key.match(/(\d{8,})$/)
    if (tailDigits) return tailDigits[1]
    return key.replace(/^gog_/i, '')
}

function tableExists(db, name) {
    const res = db.exec(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='${name.replace(/'/g, "''")}'`
    )
    return Boolean(res[0]?.values?.length)
}

function pieceTypeId(db, type) {
    const res = db.exec(
        `SELECT id FROM GamePieceTypes WHERE type='${type.replace(/'/g, "''")}' LIMIT 1`
    )
    const id = res[0]?.values?.[0]?.[0]
    return typeof id === 'number' ? id : id != null ? Number(id) : null
}

function readDatabaseBuffer(databasePath) {
    try {
        return fs.readFileSync(databasePath)
    } catch (error) {
        if (error.code !== 'EBUSY' && error.code !== 'EPERM' && error.code !== 'EACCES') throw error
        const tempCopy = path.join(
            process.env.TEMP || process.env.TMP || '.',
            `unified-launcher-gog-${Date.now()}.db`
        )
        fs.copyFileSync(databasePath, tempCopy)
        try {
            return fs.readFileSync(tempCopy)
        } finally {
            try {
                fs.unlinkSync(tempCopy)
            } catch {
                /* ignore */
            }
        }
    }
}

function queryOwnedGogGames(db) {
    if (!tableExists(db, 'GamePieces')) {
        throw new Error(
            'GOG Galaxy database format is not supported. Update GOG Galaxy and open it once while signed in.'
        )
    }

    const titleTypeId = pieceTypeId(db, 'title')
    if (titleTypeId == null) {
        throw new Error('GOG Galaxy database is missing game metadata. Open GOG Galaxy and sync your library.')
    }

    const hasLibraryReleases = tableExists(db, 'libraryreleases')
    const hasPurchaseDates = tableExists(db, 'ProductPurchaseDates')
    if (!hasLibraryReleases && !hasPurchaseDates) {
        throw new Error(
            'GOG Galaxy database format is not supported. Update GOG Galaxy and open it once while signed in.'
        )
    }

    const fromTable = hasLibraryReleases ? 'libraryreleases lr' : 'ProductPurchaseDates ppd'
    const releaseCol = hasLibraryReleases ? 'lr.releaseKey' : 'ppd.gameReleaseKey'

    const sql = `
        SELECT DISTINCT
            ${releaseCol} AS releaseKey,
            title_gp.value AS titleValue
        FROM ${fromTable}
        INNER JOIN GamePieces title_gp
            ON title_gp.releaseKey = ${releaseCol}
            AND title_gp.gamePieceTypeId = ${titleTypeId}
        WHERE lower(${releaseCol}) LIKE 'gog_%'
        ORDER BY titleValue;
    `

    const result = db.exec(sql)
    const rows = result[0]?.values ?? []
    const games = []
    const seen = new Set()

    for (const row of rows) {
        const releaseKey = String(row[0] ?? '').trim()
        const title = parseTitleValue(row[1])
        if (!releaseKey || !title) continue
        if (/^dlc_?\d/i.test(title)) continue

        const productId = releaseKeyToProductId(releaseKey)
        const idKey = productId || releaseKey
        if (seen.has(idKey)) continue
        seen.add(idKey)

        games.push({ releaseKey, productId: idKey, title })
    }

    return games
}

async function main() {
    const databasePath = process.argv[2]
    if (!databasePath) {
        console.error('Usage: read-gog-library.mjs <path-to-galaxy-2.0.db>')
        process.exit(1)
    }
    if (!fs.existsSync(databasePath)) {
        console.error(`Database not found: ${databasePath}`)
        process.exit(1)
    }

    const wasmCandidates = [
        path.join(__dirname, '..', 'sql-wasm.wasm'),
        path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
        path.join(__dirname, '..', '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
    ]
    const wasmPath = wasmCandidates.find(p => fs.existsSync(p))

    const SQL = await initSqlJs(wasmPath ? { locateFile: () => wasmPath } : undefined)
    const buffer = readDatabaseBuffer(databasePath)
    const db = new SQL.Database(buffer)
    try {
        const games = queryOwnedGogGames(db)
        process.stdout.write(JSON.stringify(games))
    } finally {
        db.close()
    }
}

main().catch(err => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
})
