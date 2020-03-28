import RpcRemoteServer from './RpcRemoteServer'
import RpcRemoteClient from './RpcRemoteClient'
import { Foo } from './Fixtures/Foo'
import { assert } from 'chai'
import { TestTransport } from './Fixtures/TestTransport'

describe('Rpc', () => {
  describe('implements rpc messaging on top of ITransport', function() {

    this.timeout(10*1000)

    it('males rpc calls between client and server', async () => {
      const transport = new TestTransport()
      const server = new RpcRemoteServer(transport.server)      
      const client = new RpcRemoteClient(transport.client)
      server.expose(new Foo(), 'foo')

      const foo = await client.getRemote('foo') as Foo
      assert.equal(await foo.name, 'foo')

      const number = await foo.incrementNumberAsync(42)
      assert.equal(number, 43)
    })
    
  })
})
