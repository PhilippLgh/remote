import { assert } from 'chai'
import { Foo } from '../Fixtures/Foo'
import { valueToMeta } from './ValueToMeta'

describe('ValueToMeta', () => {
  it('serializes an object', () => {
    const foo  = new Foo()
    const meta = valueToMeta(foo)
    console.log(JSON.stringify(meta, null, 2))
    assert.isDefined(meta)
  })
})
