import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { ChangeSetService } from '../changeset/service.js'
import {
  currentYearMonth,
  dayPrefix,
  ensureYearMonthDirs,
  LocalCrudError,
  timestamp,
  writeTracked,
} from '../local/service.js'

export interface ImportResult {
  path: string
  filename: string
  year_month: string
}

const RUN_ID = 'materials-manual'

export class MaterialsService {
  constructor(
    private readonly workspaceRoot: string,
    private readonly changeSetService: ChangeSetService,
    private readonly now = () => new Date(),
  ) {}

  importFile(srcPath: string): ImportResult {
    if (!existsSync(srcPath)) throw new LocalCrudError('file_not_found', '文件不存在', 404)
    const ym = currentYearMonth(this.now())
    ensureYearMonthDirs(this.workspaceRoot, ym)
    const raw = join(this.workspaceRoot, ym, 'raw')
    const ext = extname(srcPath)
    const stem = basename(srcPath, ext)
    const filename = `${dayPrefix(this.now())}-${stem}-${hash8(srcPath)}${ext}`
    const dest = join(raw, filename)
    if (!existsSync(dest)) {
      writeTracked(this.changeSetService, this.workspaceRoot, RUN_ID, dest, readFileSync(srcPath))
      copyFileSync(srcPath, dest)
    }
    return { path: dest, filename, year_month: ym }
  }

  importText(text: string): ImportResult {
    const ym = currentYearMonth(this.now())
    ensureYearMonthDirs(this.workspaceRoot, ym)
    const filename = `${dayPrefix(this.now())}-paste-${timestamp(this.now())}.txt`
    const dest = join(this.workspaceRoot, ym, 'raw', filename)
    writeTracked(this.changeSetService, this.workspaceRoot, RUN_ID, dest, text)
    return { path: `${ym}/raw/${filename}`, filename, year_month: ym }
  }

  importTextTemp(text: string): ImportResult {
    const filename = `paste-${timestamp(this.now())}.txt`
    const dest = join(tmpdir(), filename)
    writeFileSync(dest, text)
    return { path: dest, filename, year_month: '' }
  }

  importImageTemp(data: string, mediaType: string): ImportResult {
    const ext =
      mediaType === 'image/jpeg'
        ? 'jpg'
        : mediaType === 'image/gif'
          ? 'gif'
          : mediaType === 'image/webp'
            ? 'webp'
            : 'png'
    const filename = `paste-${timestamp(this.now())}.${ext}`
    const dest = join(tmpdir(), filename)
    writeFileSync(dest, Buffer.from(data, 'base64'))
    return { path: dest, filename, year_month: '' }
  }
}

function hash8(path: string): string {
  try {
    return rustDefaultHasherHex(readFileSync(path)).slice(0, 8)
  } catch {
    return 'unknown'
  }
}

export function rustDefaultHasherHex(data: Buffer): string {
  const len = Buffer.alloc(8)
  len.writeBigUInt64LE(BigInt(data.length))
  return sipHash13(Buffer.concat([len, data])).toString(16)
}

const MASK_64 = (1n << 64n) - 1n

function rotl(value: bigint, shift: bigint): bigint {
  return ((value << shift) | (value >> (64n - shift))) & MASK_64
}

function sipRound(state: [bigint, bigint, bigint, bigint]): void {
  state[0] = (state[0] + state[1]) & MASK_64
  state[1] = rotl(state[1], 13n)
  state[1] ^= state[0]
  state[0] = rotl(state[0], 32n)
  state[2] = (state[2] + state[3]) & MASK_64
  state[3] = rotl(state[3], 16n)
  state[3] ^= state[2]
  state[0] = (state[0] + state[3]) & MASK_64
  state[3] = rotl(state[3], 21n)
  state[3] ^= state[0]
  state[2] = (state[2] + state[1]) & MASK_64
  state[1] = rotl(state[1], 17n)
  state[1] ^= state[2]
  state[2] = rotl(state[2], 32n)
}

function sipHash13(input: Buffer): bigint {
  const state: [bigint, bigint, bigint, bigint] = [
    0x736f6d6570736575n,
    0x646f72616e646f6dn,
    0x6c7967656e657261n,
    0x7465646279746573n,
  ]
  let offset = 0
  while (offset + 8 <= input.length) {
    const m = input.readBigUInt64LE(offset)
    state[3] ^= m
    sipRound(state)
    state[0] ^= m
    offset += 8
  }
  let b = BigInt(input.length) << 56n
  for (let i = 0; offset + i < input.length; i += 1) {
    b |= BigInt(input[offset + i]) << BigInt(8 * i)
  }
  state[3] ^= b
  sipRound(state)
  state[0] ^= b
  state[2] ^= 0xffn
  sipRound(state)
  sipRound(state)
  sipRound(state)
  return (state[0] ^ state[1] ^ state[2] ^ state[3]) & MASK_64
}
