export const v8Util = {
  getHiddenValue<T>(obj: any, tag: string) {
    return obj[`_hidden_${tag}`] as T
  },
  setHiddenValue(obj: any, tag: string, val: any) {
    obj[`_hidden_${tag}`] = val
  },
  deleteHiddenValue(obj: any, tag: string) {
    delete obj[`_hidden_${tag}`]
  }
}