import { assert } from 'chai'
import { RemoteServer } from './RemoteServer'
import { Foo, Bar } from './Fixtures/Foo'
import { SyncRemoteClient, AsyncRemoteClient } from './Fixtures/Fake'

describe('Remote Server', function () {
  this.timeout(30 * 1000)

  describe.skip('Sync Client<->Server Communication', () => {
    it('should handle sync com', async () => {

      const remoteServer = new RemoteServer()
      remoteServer.exposeObject(new Foo(), 'foo')
      // console.log('meta', JSON.stringify(meta))

      const remoteClient = new SyncRemoteClient(remoteServer)

      const foo = remoteClient.getObject('foo') as Foo

      assert.equal(foo.name, 'foo')

      const number = await foo.getNumberPromise(42)
      assert.equal(number, 42)

      const bar = await foo.getBar() as Bar
      assert.equal(bar.type, 'bar')

      const result = await bar.doSomething()
      assert.equal(result, 'did something')
    })
  })

  describe('Async Client<->Server Communication', () => {
    it('should handle async com', async () => {
      const remoteServer = new RemoteServer()
      remoteServer.exposeObject(new Foo(), 'foo')
      // console.log('meta', JSON.stringify(meta))

      const remoteClient = new AsyncRemoteClient(remoteServer)

      const foo = await remoteClient.getObject('foo') as Foo

      assert.equal(await foo.name, 'foo')

      const number = await foo.getNumberPromise(42)
      assert.equal(number, 42)

      const bar = await foo.getBar() as Bar
      assert.equal(await bar.type, 'bar')

      const result = await bar.doSomething()
      assert.equal(result, 'did something')
    })
  })

})