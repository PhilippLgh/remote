import { assert } from 'chai'
import { valueToMeta } from './ValueToMeta'
import { metaToValue, NoCom } from './MetaToValue'
import { ObjectRegistry } from './ObjectRegistry'
import { CallbacksRegistry } from '../CallbacksRegistry'

describe('Serialization', () => {
  describe('serializes/de-serializes', () => {

    const testData: any = {
      'numbers': [Number.MIN_VALUE, -1, 0, 10, Number.MAX_VALUE],
      'boolean': [true, false],
      'strings': ['', `${'""'}`, "\"hello", "Öä-.›~,<>#*´()!§$%&'"],
      // @ts-ignore
      'bigint': [9007199254740991n, BigInt(9007199254740991)],
      // TODO
      'symbols': [],
      'undefined': [undefined],
      'buffer': [Buffer.from('string_buffer'), Buffer.from([0x12])],
      // TODO check comparison
      'errors': [new Error('FooError')],
    }

    for (const key in testData) {
      const values = testData[key]
      describe(key, () => {
        for (const val of values) {
          it(`serializes ${val ? val.toString() : val}`, () => {
            const meta = valueToMeta(val)
            const _valRecovered = metaToValue(meta)
            if (Buffer.isBuffer(val)) {
              assert.isTrue(_valRecovered.equals(val))
            }
            else {
              assert.equal(_valRecovered, val)
            }
          })
        }
      })
    }

    describe('Sync Communication', () => {
      /**
       * Objects are lazily evaluated which means if a
       * a member of a proxy object is accessed a request is made
       * which gets the member information of the remote object
       */
      describe('POJOs', () => {
        it('serializes a pojo', () => {
          const val: any = {
            name: 'pojo1',
            age: 10,
          }
          const meta = valueToMeta(val, {
            addObject: () => '1' // not needed in this case: no-op
          })

          const com = new class com extends NoCom {
            getRemoteMember(objectId: string, memberName: string) {
              return val[memberName]
            }
          }
          const _valRecovered = metaToValue(meta, com)
          assert.deepEqual(_valRecovered, val)
        })

        it('serializes multiple pojos', () => {
          const val1: any = {
            name: 'pojo1',
            age: 10,
          }
          const val2: any = {
            name: 'pojo2',
            age: 20,
          }
          const objectsRegistry = new ObjectRegistry()
          const options = {
            addObject: (object: any, contextId: string) => objectsRegistry.add(object)
          }
          const meta1 = valueToMeta(val1, options)
          const meta2 = valueToMeta(val2, options)

          /**
           * the objects registry is necessary to associate ids from request with objects
           */
          const com = new class com extends NoCom {
            getRemoteMember(objectId: string, memberName: string) {
              const obj = objectsRegistry.get(objectId)
              return obj[memberName]
            }
          }
          const valRecovered1 = metaToValue(meta1, com)
          const valRecovered2 = metaToValue(meta2, com)
          assert.deepEqual(valRecovered1, val1)
          assert.deepEqual(valRecovered2, val2)
        })
      })

      describe('promises', function() {
        this.timeout(10*1000)
        it('serializes promises #1', async () => {

          const val = Promise.resolve('hello')

          const objects = new ObjectRegistry()
          const meta = valueToMeta(val, {
            addObject: (object: any, contextId: string) => objects.add(object)
          })

          const callbacks = new CallbacksRegistry()
          const com = new class com extends NoCom {
            callRemoteFunction(objectId: string, args: any[]) {
              // if then from a promise is accessed a call is made
              // to the remote function: remoteFunction(resolve, reject)
              // args contains resolve and reject
              // before the call is made to server arguments are wrapped
              // which as a side-effect adds them to the callbacksRegistry
              // valueToMeta ~ line 337 - id: callbacksRegistry.add(value),
              let resolve = args[0]
              let reject = args[1]
              const resolveId = callbacks.add(resolve)
              const rejectId = callbacks.add(reject)

              // on the server side when the arguments are unwrapped
              // and the meta type 'callback' is handled the functions are wrapped
              resolve = (...args: any[]) => {
                // send message with callback id to client
                // instead we just call directly
                callbacks.apply(resolveId, args)
              }

              // functionCall() ...
              const fn = objects.get(objectId)
              fn(resolve, reject)
            }
          }
          const valRecovered = metaToValue(meta, com)
          const result = await valRecovered
          assert.equal(result, 'hello')
        })
        it.skip('serializes promises #2', async () => {
          const val = new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve(200)
            }, 200)
          })
          const meta = valueToMeta(val)
          const _valRecovered = metaToValue(meta)
        })
      })
    })

    /**
     * In most scenarios (no testing, no special environments (electron))
     * we won't have synchronous IPC which is why async de-serialization 
     * testing is more important
     */
    describe('Async Communication', () => {

      describe('promises', function() {
        this.timeout(10*1000)
        it.only('serializes promises #1', async () => {

          const val = Promise.resolve('hello')

          const objects = new ObjectRegistry()
          const meta = valueToMeta(val, {
            addObject: (object: any, contextId: string) => objects.add(object)
          })

          const callbacks = new CallbacksRegistry()
          const com = new class com extends NoCom {
            callRemoteFunction(objectId: string, args: any[]) {
              // if then from a promise is accessed a call is made
              // to the remote function: remoteFunction(resolve, reject)
              // args contains resolve and reject
              // before the call is made to server arguments are wrapped
              // which as a side-effect adds them to the callbacksRegistry
              // valueToMeta ~ line 337 - id: callbacksRegistry.add(value),
              let resolve = args[0]
              let reject = args[1]
              const resolveId = callbacks.add(resolve)
              const rejectId = callbacks.add(reject)

              // on the server side when the arguments are unwrapped
              // and the meta type 'callback' is handled the functions are wrapped
              resolve = (...args: any[]) => {
                // send message with callback id to client
                // instead we just call directly
                callbacks.apply(resolveId, args)
              }

              // functionCall() ...
              const fn = objects.get(objectId)
              fn(resolve, reject)
            }
          }
          const valRecovered = metaToValue(meta, com)
          const result = await valRecovered
          assert.equal(result, 'hello')
        })
        it('serializes promises #2', async () => {
          const val = new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve(200)
            }, 200)
          })
          const meta = valueToMeta(val)
          const _valRecovered = metaToValue(meta)
        })
      })
    })

  })
})
