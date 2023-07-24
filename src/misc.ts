import { readFileSync } from "node:fs";

export type AnyObject = { [index: string]: any };

export const toLowerCaseObject = (obj: AnyObject) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));

export const readJsonFile = (path: string) => JSON.parse(readFileSync(path).toString());

// construct result object from defined fileds of source object
export const onlyDefinedFields = (source: any) => {
  return Object.keys(source).reduce((acc: typeof source, key: string) => {
    if (source[key] !== undefined) {
      acc[key] = source[key];
    }
    return acc;
  }, {});
};
