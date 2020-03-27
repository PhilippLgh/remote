export class RemoteObjectCache {
  _objects: any = {}
  set(metaId: string, obj: any) {
    // console.log('object with id', metaId, 'is put in cache')
    this._objects[metaId] = obj
  }
  has(metaId: string): boolean {
    const res = metaId in this._objects
    // console.log('object cache request for', metaId, res)
    return res
  }
  get(metaId: string) {
    return this._objects[metaId]
  }
}