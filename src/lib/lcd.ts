import { delay } from 'bluebird'
import { LCDClient, TxInfo, Wallet, Msg } from '@initia/minitia.js'
import { getL2Denom } from './util'
import { BridgeConfig } from './types'
import config from '../config'

export async function transaction(
  wallet: Wallet,
  msgs: Msg[],
  accountNumber?: number,
  sequence?: number
): Promise<TxInfo | undefined> {
  const signedTx = await wallet.createAndSignTx({
    msgs,
    accountNumber,
    sequence,
  })
  const broadcastResult = await wallet.lcd.tx.broadcast(signedTx)
  if (broadcastResult['code']) throw new Error(broadcastResult.raw_log)
  return checkTx(wallet.lcd, broadcastResult.txhash)
}

export async function checkTx(
  lcd: LCDClient,
  txHash: string,
  timeout = 60000
): Promise<TxInfo | undefined> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeout) {
    const txInfo = await lcd.tx.txInfo(txHash)
    if (txInfo) return txInfo
    await delay(1000)
  }
}

export async function fetchBridgeConfig(): Promise<BridgeConfig> {
  const cfg = await config.l1lcd.move
    .viewFunction<BridgeConfig>(
        '0x1',
        'op_output',
        'get_config_store',
        [config.L2ID],
        []
    )
  return cfg
}

export async function getCoinInfo(
  lcd: LCDClient,
  structTag: string,
  l2Token: Buffer
): Promise<CoinInfo> {
  const address = structTag.split('::')[0]
  const resource = await lcd.move.resource<{
    name: string
    symbol: string
    decimals: number
  }>(address, `0x1::coin::CoinInfo<${structTag}>`)

  return {
    structTag,
    denom: getL2Denom(l2Token),
    name: resource.data.name,
    symbol: resource.data.symbol,
    decimals: resource.data.decimals,
  }
}

export interface CoinInfo {
  structTag: string
  denom: string
  name: string
  symbol: string
  decimals: number
}
