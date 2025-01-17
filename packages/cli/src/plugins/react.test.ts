import dedent from 'dedent'
import { default as fse } from 'fs-extra'
import { describe, expect, it } from 'vitest'

import { createFixture, typecheck, wagmiAbi } from '../../test'
import { format } from '../utils'
import { react } from './react'

describe('react', () => {
  describe('run', () => {
    it(
      'with TypeScript',
      async () => {
        const { imports, content } = await react().run({
          contracts: [
            {
              name: 'Wagmi',
              abi: wagmiAbi,
              content: '',
              meta: {
                abiName: 'wagmiAbi',
                configName: 'wagmiConfig',
              },
            },
          ],
          isTypeScript: true,
          outputs: [],
        })
        await expect(
          format(`${imports}\n\n${content}`),
        ).resolves.toMatchSnapshot()

        const { paths } = await createFixture({
          copyNodeModules: true,
          files: {
            tsconfig: true,
            'generated.ts': dedent`
              ${imports}

              export const wagmiAbi = ${JSON.stringify(wagmiAbi)} as const

              ${content}
            `,
            'index.ts': dedent`
              import { BigNumber } from '@ethersproject/bignumber'
              import { usePrepareWagmiWrite, useWagmiWrite } from './generated'
    
              const { config } = usePrepareWagmiWrite({
                functionName: 'approve',
                args: ['0xA0Cf798816D4b9b9866b5330EEa46a18382f251e', BigNumber.from('123')],
              })
              const { write: preparedWrite } = useWagmiWrite(config)
              preparedWrite?.()
              
              const { write: unpreparedWrite } = useWagmiWrite({
                mode: 'recklesslyUnprepared',
                functionName: 'approve',
              })
              unpreparedWrite({
                recklesslySetUnpreparedArgs: ['0xA0Cf798816D4b9b9866b5330EEa46a18382f251e', BigNumber.from('123')],
              })
            `,
          },
        })

        const tsconfig = await fse.readJSON(paths.tsconfig)
        await fse.writeJSON(paths.tsconfig, {
          ...tsconfig,
          include: [paths['generated.ts'], paths['index.ts']],
        })

        await expect(typecheck(paths.tsconfig)).resolves.toMatchInlineSnapshot(
          '""',
        )
      },
      {
        timeout: 20_000,
      },
    )

    it('without TypeScript', async () => {
      const { imports, content } = await react().run({
        contracts: [
          {
            name: 'Wagmi',
            address: '0xaf0326d92b97df1221759476b072abfd8084f9be',
            abi: wagmiAbi,
            content: '',
            meta: {
              abiName: 'wagmiAbi',
              addressName: 'wagmiAddress',
              configName: 'wagmiConfig',
            },
          },
        ],
        isTypeScript: false,
        outputs: [],
      })
      await expect(
        format(`${imports}\n\n${content}`),
      ).resolves.toMatchSnapshot()
    })

    it('throws for duplicate hook names', async () => {
      await expect(
        react().run({
          contracts: [
            {
              name: 'Inventory',
              address: '0xaf0326d92b97df1221759476b072abfd8084f9be',
              abi: [
                {
                  name: 'cardsCollection',
                  type: 'function',
                  stateMutability: 'view',
                  outputs: [{ type: 'string' }],
                  inputs: [],
                },
              ],
              content: '',
              meta: {
                abiName: 'inventoryAbi',
                addressName: 'inventoryAddress',
                configName: 'inventoryConfig',
              },
            },
            {
              name: 'InventoryCardsCollection',
              address: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
              abi: [
                {
                  name: 'foo',
                  type: 'function',
                  stateMutability: 'view',
                  outputs: [{ type: 'address' }],
                  inputs: [],
                },
              ],
              content: '',
              meta: {
                abiName: 'inventoryCardsCollectionAbi',
                addressName: 'inventoryCardsCollectionAddress',
                configName: 'inventoryCardsCollectionConfig',
              },
            },
          ],
          isTypeScript: false,
          outputs: [],
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        '"Hook name \\"useInventoryCardsCollection\\" must be unique for contract \\"InventoryCardsCollection\\"."',
      )
    })
  })
})
