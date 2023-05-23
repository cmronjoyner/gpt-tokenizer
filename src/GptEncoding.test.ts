import { GptEncoding } from './GptEncoding.js'
import { type EncodingName, encodingNames } from './mapping.js'
import { resolveEncoding } from './resolveEncoding.js'

const sharedResults = {
  space: [220],
  tab: [197],
  'This is some text': [1_212, 318, 617, 2_420],
  indivisible: [521, 452, 12_843],
  'hello 👋 world 🌍': [31_373, 50_169, 233, 995, 12_520, 234, 235],
  decodedHelloWorldTokens: ['hello', ' ', '👋', ' world', ' ', '🌍'],
  'toString constructor hasOwnProperty valueOf': [
    1_462, 10_100, 23_772, 468, 23_858, 21_746, 1_988, 5_189,
  ],
  'hello, I am a text, and I have commas. a,b,c': [
    31_373, 11, 314, 716, 257, 2_420, 11, 290, 314, 423, 725, 292, 13, 257, 11,
    65, 11, 66,
  ],
}

const results = {
  cl100k_base: {
    space: [220],
    tab: [197],
    'This is some text': [2_028, 374, 1_063, 1_495],
    indivisible: [485, 344, 23_936],
    'hello 👋 world 🌍': [15_339, 62_904, 233, 1_917, 11_410, 234, 235],
    decodedHelloWorldTokens: ['hello', ' ', '👋', ' world', ' ', '🌍'],
    'toString constructor hasOwnProperty valueOf': [
      6_712, 4_797, 706, 19_964, 907, 2_173,
    ],
    'hello, I am a text, and I have commas. a,b,c': [
      15_339, 11, 358, 1_097, 264, 1_495, 11, 323, 358, 617, 77_702, 13, 264,
      8_568, 10_317,
    ],
  },
  p50k_base: sharedResults,
  p50k_edit: sharedResults,
  r50k_base: sharedResults,
} satisfies Record<EncodingName, unknown>

describe.each(encodingNames)('%s', (encodingName: EncodingName) => {
  const encoding = GptEncoding.getEncodingApi(encodingName, resolveEncoding)

  const {
    decode,
    decodeGenerator,
    decodeAsyncGenerator,
    encode,
    isWithinTokenLimit,
  } = encoding

  const result = results[encodingName]

  describe('basic functionality', () => {
    it('empty string', () => {
      const str = ''
      expect(encode(str)).toEqual([])
      expect(decode(encode(str))).toEqual(str)
      expect(isWithinTokenLimit(str, 0)).toBe(0)
      expect(isWithinTokenLimit(str, 3)).toBe(0)
    })

    it('space', () => {
      const str = ' '
      expect(encode(str)).toEqual(result.space)
      expect(decode(encode(str))).toEqual(str)
      expect(isWithinTokenLimit(str, 3)).toBe(1)
      expect(isWithinTokenLimit(str, 0)).toBe(false)
    })

    it('tab', () => {
      const str = '\t'
      expect(encode(str)).toEqual(result.tab)
      expect(decode(encode(str))).toEqual(str)
    })

    it('simple text', () => {
      const str = 'This is some text'
      expect(encode(str)).toEqual(result[str])
      expect(decode(encode(str))).toEqual(str)
      expect(isWithinTokenLimit(str, 3)).toBe(false)
      expect(isWithinTokenLimit(str, 5)).toBe(result[str].length)
    })

    it('multi-token word', () => {
      const str = 'indivisible'
      expect(encode(str)).toEqual(result.indivisible)
      expect(decode(encode(str))).toEqual(str)
      expect(isWithinTokenLimit(str, 3)).toBe(result.indivisible.length)
    })

    it('emojis', () => {
      const str = 'hello 👋 world 🌍'
      expect(encode(str)).toEqual(result[str])
      expect(decode(encode(str))).toEqual(str)
      expect(isWithinTokenLimit(str, 4)).toBe(false)
      expect(isWithinTokenLimit(str, 400)).toBe(result[str].length)
    })

    it('decode token-by-token via generator', () => {
      const str = 'hello 👋 world 🌍'
      const generator = decodeGenerator(result[str])
      result.decodedHelloWorldTokens.forEach((token) => {
        expect(generator.next().value).toBe(token)
      })
    })

    async function* getHelloWorldTokensAsync() {
      const str = 'hello 👋 world 🌍'
      for (const token of result[str]) {
        // eslint-disable-next-line no-await-in-loop
        yield await Promise.resolve(token)
      }
    }

    it('decode token-by-token via async generator', async () => {
      const generator = decodeAsyncGenerator(getHelloWorldTokensAsync())
      const decoded = [...result.decodedHelloWorldTokens]
      for await (const value of generator) {
        expect(value).toEqual(decoded.shift())
      }
    })

    it('properties of Object', () => {
      const str = 'toString constructor hasOwnProperty valueOf'

      expect(encode(str)).toEqual(result[str])
      expect(decode(encode(str))).toEqual(str)
    })

    it('text with commas', () => {
      const str = 'hello, I am a text, and I have commas. a,b,c'
      expect(decode(encode(str))).toEqual(str)
      expect(encode(str)).toStrictEqual(result[str])
      expect(isWithinTokenLimit(str, result[str].length - 1)).toBe(false)
      expect(isWithinTokenLimit(str, 300)).toBe(result[str].length)
    })
  })
})
