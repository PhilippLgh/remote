import { assert } from 'chai'
import { RemoteServer } from './RemoteServer'
import { Foo, Bar } from './Fixtures/Foo'
import { AsyncRemoteClient } from './Fixtures/Fake'

describe('Remote Server', function () {
  this.timeout(10 * 1000)

  describe('Async Client<->Server Communication', () => {
    it('should handle async com', async () => {
      const remoteServer = new RemoteServer()
      remoteServer.exposeObject(new Foo(), 'foo')
      // console.log('meta', JSON.stringify(meta))

      const remoteClient = new AsyncRemoteClient(remoteServer)

      const foo = await remoteClient.getRemote('foo') as Foo

      assert.equal(await foo.name, 'foo')

      const number = await foo.incrementNumberAsync(42)
      assert.equal(number, 43)
      /*

      const bar = await foo.getBar() as Bar
      assert.equal(await bar.type, 'bar')

      const result = await bar.doSomething()
      assert.equal(result, 'did something')
      */
    })
  })

})