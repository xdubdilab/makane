import { inspect } from 'util'
import * as assert from 'assert'
import * as createDebug from 'debug'
import { pick, trimStart } from 'lodash'
import { readFile, writeFile } from 'mz/fs'
import { dialog, FileFilter, OpenDialogOptions } from 'electron'
import Validator = require('async-validator')

import * as pm from './pm'
import {
  DeepPartial,
  ProcessDescription,
  CreateProcessOptions,
} from '../common/types'

const debug = createDebug('makane:b:snapshot')

type ProcessesSnapshot = {
  version: string
  cpos: Array<CreateProcessOptions>
}

const CURRENT_SNAPSHOT_VERSION = '0-alpha'

const generate = (
  descriptions: Array<ProcessDescription>,
): ProcessesSnapshot => ({
  version: CURRENT_SNAPSHOT_VERSION,
  cpos: descriptions.map(d => pick(d, ['name', 'options'])),
})

const serialize = (snapshot: ProcessesSnapshot): string =>
  trimStart(`
// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY
// Makane Processes Snapshot
${JSON.stringify(snapshot, undefined, 2)}
`)

const required = true

const validator = new Validator({
  version: { type: 'string', required },
  cpos: {
    type: 'array',
    required,
    defaultField: {
      type: 'object',
      required,
      fields: {
        name: { type: 'string', required },
        options: {
          type: 'object',
          required,
          fields: {
            command: { type: 'string', required },
            arguments: {
              type: 'array',
              required,
              defaultField: { type: 'string', required },
            },
            cwd: { type: 'string', required },
          },
        },
      },
    },
  },
})

const validate = (source: DeepPartial<ProcessesSnapshot>) =>
  new Promise<ProcessesSnapshot>((resolve, reject) => {
    validator.validate(source, (errors, fields) => {
      if (errors) {
        reject(errors)
      } else {
        try {
          const snapshot = source as ProcessesSnapshot
          assert.equal(
            snapshot.version,
            CURRENT_SNAPSHOT_VERSION,
            'invalid snapshot version',
          )
          assert.ok(snapshot.cpos, 'invalid snapshot cpos')
          resolve(snapshot)
        } catch (error) {
          Reflect.deleteProperty(error, 'stack')
          reject(error)
        }
      }
    })
  })

const filters: Array<FileFilter> = [{ name: 'JSON', extensions: ['json'] }]

export const save = () => {
  debug('saving snapshot')

  dialog.showSaveDialog({ filters }, async filename => {
    if (!filename) {
      debug('user clicked cancel')
      return
    }

    debug("saving snapshot to '%s'", filename)

    try {
      const snapshot = generate(pm.list())

      debug('generated snapshot: %s', JSON.stringify(snapshot, undefined, 2))

      const text = serialize(snapshot)

      await writeFile(filename, text, 'utf-8')
    } catch (error) {
      debug('error while saving snapshot: %O', error)

      dialog.showErrorBox('Error while saving snapshot', inspect(error))
    }
  })
}

export const load = () => {
  debug('loading snapshot')

  const dialogOptions: OpenDialogOptions = { filters, properties: ['openFile'] }

  dialog.showOpenDialog(dialogOptions, async filenames => {
    if (!filenames) {
      debug('user clicked cancel')
      return
    }

    const filename = filenames[0]

    debug("loading snapshot from '%s'", filename)

    try {
      const text = await readFile(filename, 'utf-8')

      const snapshot = await validate(JSON.parse(text.replace(/\/\/.*\n/g, '')))

      debug('read snapshot: %s', JSON.stringify(snapshot, undefined, 2))

      snapshot.cpos.forEach(pm.create)
    } catch (error) {
      debug('error while loading snapshot: %O', error)

      dialog.showErrorBox('Error while loading snapshot', inspect(error))
    }
  })
}
