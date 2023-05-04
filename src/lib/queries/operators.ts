import { retryBackoff } from '../utils/retryBackoff'
import { type QuerxOptions } from './types'

export const retryFromOptions = (options: QuerxOptions) =>
  retryBackoff({
    initialInterval: 100,
    ...(typeof options.retry === 'function'
      ? {
          shouldRetry: options.retry
        }
      : {
          maxRetries: options.retry === false ? 0 : options.retry ?? 3
        })
  })
