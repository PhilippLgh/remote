console.log('child process running')
import { Client, IpcTransport } from '../index'
import { Foo } from './Foo'
import { assert } from 'chai'

const client = new Client(new IpcTransport())

async function start() {
  // get reference to an existing / exposed object
  const foo = await client.getRemote('foo') as Foo

  // TODO
  // const { Foo } = require('remote')
  // const foo = new Foo()

  // console.log('foo', foo)
  assert.isDefined(foo)

  // failing assert statements create AssertionErrors
  assert.equal(await foo.name, 'foo') 
  
  const number = await foo.incrementNumberAsync(42)
  console.log('number is', number)
  assert.equal(number, 43)

}

start()
  .then(() => {
    console.log('start is done')
    process.exit(0)
  })
  .catch(error => {
    console.log('error in start', error)
    // forward assertion errors
    process.send && process.send(error)
    setTimeout(() => {
      process.exit(1)
    }, 500)
  })