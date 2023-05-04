import { describe, it, expect } from 'vitest'
import { shallowEqual } from './shallowEqual'

describe('shallowEqual', () => {
  it('returns true for two null values', () => {
    expect(shallowEqual(null, null)).toBe(true)
  })

  it('returns true for two undefined values', () => {
    expect(shallowEqual(undefined, undefined)).toBe(true)
  })

  it('returns false for a null value and an undefined value', () => {
    expect(shallowEqual(null, undefined)).toBe(false)
  })

  it('returns true for two string values that are equal', () => {
    expect(shallowEqual('hello', 'hello')).toBe(true)
  })

  it('returns false for two string values that are not equal', () => {
    expect(shallowEqual('hello', 'world')).toBe(false)
  })

  it('returns true for two number values that are equal', () => {
    expect(shallowEqual(42, 42)).toBe(true)
  })

  it('returns false for two number values that are not equal', () => {
    expect(shallowEqual(42, 3.14)).toBe(false)
  })

  it('returns true for two boolean values that are equal', () => {
    expect(shallowEqual(true, true)).toBe(true)
  })

  it('returns false for two boolean values that are not equal', () => {
    expect(shallowEqual(true, false)).toBe(false)
  })

  it('returns true for two objects with the same properties and values', () => {
    const obj1 = { a: 1, b: 'hello', c: true }
    const obj2 = { a: 1, b: 'hello', c: true }
    expect(shallowEqual(obj1, obj2)).toBe(true)
  })

  it('returns false for two objects with different properties', () => {
    const obj1 = { a: 1, b: 'hello' }
    const obj2 = { a: 1, c: true }
    expect(shallowEqual(obj1, obj2)).toBe(false)
  })

  it('returns false for two objects with different property values', () => {
    const obj1 = { a: 1, b: 'hello' }
    const obj2 = { a: 1, b: 'world' }
    expect(shallowEqual(obj1, obj2)).toBe(false)
  })

  it('returns false for an object and a primitive value', () => {
    const obj1 = { a: 1, b: 'hello' }
    const obj2 = 'hello'
    expect(shallowEqual(obj1, obj2)).toBe(false)
  })
})
